import { createServer } from "node:http";
import { withSupabase } from "@supabase/server";
import { reviewSection, SECTIONS } from "./grading.js";
import { notify, notifyMany } from "./notifications.js";
import { emailShell } from "./mailer.js";

// Used to build links back into the app from inside notification emails.
const APP_URL = process.env.APP_URL || "https://sabnahis-ste.github.io/E-TuklasOnlineChecker/";

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}

// ── Helper: read the caller's profile role using the RLS-scoped client ──
async function getRole(ctx) {
  const { data: userRes } = await ctx.supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) return null;
  const { data } = await ctx.supabase.from("profiles").select("role").eq("id", uid).single();
  return { uid, role: data?.role || "student" };
}

function requireRole(allowedRoles) {
  return async (ctx) => {
    const info = await getRole(ctx);
    if (!info || !allowedRoles.includes(info.role)) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    return info;
  };
}

// ── POST /api/grade ──────────────────────────────────────────────
// Body: { submissionId, sectionId, text }
// The caller must own the submission (student's own upload, or the backend
// re-validates against submissions.uploader_id). Writes the AI verdict using
// the admin client so students can never fabricate their own score client-side.
const gradeHandler = withSupabase({ auth: "user" }, async (req, ctx) => {
  const body = await req.json();
  const { submissionId, sectionId, text } = body;
  const section = SECTIONS.find(s => s.id === sectionId);
  if (!section) return Response.json({ error: "Invalid section" }, { status: 400 });
  if (!text || text.trim().length < 20) {
    return Response.json({ error: "Section text too short to grade" }, { status: 400 });
  }

  const { data: userRes } = await ctx.supabase.auth.getUser();
  const uid = userRes?.user?.id;

  const { data: sub } = await ctx.supabaseAdmin
    .from("submissions").select("uploader_id, ai_score, ai_status, submitted_at")
    .eq("id", submissionId).single();
  if (!sub || sub.uploader_id !== uid) {
    return Response.json({ error: "Not your submission" }, { status: 403 });
  }

  let verdict;
  try {
    const { data: cfgRow } = await ctx.supabaseAdmin.from("config").select("value").eq("key", "ai_provider").maybeSingle();
    verdict = await reviewSection(section.id, section.label, text, cfgRow?.value);
  } catch (e) {
    return Response.json({ error: "AI grading failed: " + e.message }, { status: 502 });
  }

  const priorHistory = sub.ai_score != null
    ? [{ score: sub.ai_score, status: sub.ai_status, submittedAt: sub.submitted_at }]
    : [];

  const { error: updateErr } = await ctx.supabaseAdmin.from("submissions").update({
    ai_status: verdict.status,
    ai_score: verdict.scorePercent,
    ai_criteria: verdict.criteria,
    ai_remarks: verdict.remarks,
    ai_provider: verdict.provider,
    ai_history: priorHistory,
    teacher_verdict: null, // a new AI grade clears any stale teacher override
    submitted_at: new Date().toISOString()
  }).eq("id", submissionId);

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });

  // Notify the student (in-app + email) that their AI verdict is in.
  // Awaited so failures are logged, but a mail hiccup never turns a
  // successful grade into a failed request (notify() itself never throws).
  try {
    const { data: studentProfile } = await ctx.supabaseAdmin
      .from("profiles").select("email, full_name").eq("id", uid).single();
    const label = section.label;
    const statusLabel = { approved: "Approved", needs_revision: "Needs Revision", rejected: "Rejected" }[verdict.status] || verdict.status;
    await notify(ctx.supabaseAdmin, {
      userId: uid,
      type: "graded",
      title: `${label}: ${statusLabel} (${verdict.scorePercent}/100)`,
      body: verdict.remarks,
      submissionId,
      email: studentProfile?.email,
      emailHtml: emailShell(
        `Your "${label}" section was graded: ${statusLabel}`,
        `<p>Score: <strong>${verdict.scorePercent}/100</strong></p><p>${verdict.remarks || ""}</p>`,
        "View feedback", APP_URL
      )
    });
  } catch (e) {
    console.error("[notify] grade notification failed:", e.message);
  }

  return Response.json({ verdict });
});

// ── POST /api/admin/teacher-verdict ─────────────────────────────
// Body: { submissionId, score, note }
const teacherVerdictHandler = withSupabase({ auth: "user" }, async (req, ctx) => {
  const info = await requireRole(["teacher", "admin"])(ctx);
  const { submissionId, score, note } = await req.json();
  const { error } = await ctx.supabaseAdmin.from("submissions").update({
    teacher_verdict: { score, note, teacherId: info.uid, decidedAt: new Date().toISOString() }
  }).eq("id", submissionId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  try {
    const { data: sub } = await ctx.supabaseAdmin
      .from("submissions").select("uploader_id, section_id").eq("id", submissionId).single();
    if (sub) {
      const { data: studentProfile } = await ctx.supabaseAdmin
        .from("profiles").select("email").eq("id", sub.uploader_id).single();
      const label = SECTIONS.find(s => s.id === sub.section_id)?.label || sub.section_id;
      await notify(ctx.supabaseAdmin, {
        userId: sub.uploader_id,
        type: "teacher_override",
        title: `Teacher reviewed your "${label}" section: ${score}/100`,
        body: note,
        submissionId,
        email: studentProfile?.email,
        emailHtml: emailShell(
          `Your teacher left feedback on "${label}"`,
          `<p>Score: <strong>${score}/100</strong></p><p>${note || ""}</p>`,
          "View feedback", APP_URL
        )
      });
    }
  } catch (e) {
    console.error("[notify] teacher-verdict notification failed:", e.message);
  }

  return Response.json({ ok: true });
});

// ── POST /api/admin/set-approval ────────────────────────────────
// Body: { userId, approved }
const setApprovalHandler = withSupabase({ auth: "user" }, async (req, ctx) => {
  await requireRole(["teacher", "admin"])(ctx);
  const { userId, approved } = await req.json();
  const { error } = await ctx.supabaseAdmin.from("profiles").update({ approved }).eq("id", userId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
});

// ── POST /api/admin/set-role ────────────────────────────────────
// Body: { userId, role }  (admin only — teachers cannot promote others)
const setRoleHandler = withSupabase({ auth: "user" }, async (req, ctx) => {
  await requireRole(["admin"])(ctx);
  const { userId, role } = await req.json();
  if (!["student", "teacher", "admin"].includes(role)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }
  const { error } = await ctx.supabaseAdmin.from("profiles").update({ role }).eq("id", userId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
});

// ── POST /api/admin/bulk-delete ─────────────────────────────────
// Body: { ids: [submissionId, ...] }
const bulkDeleteHandler = withSupabase({ auth: "user" }, async (req, ctx) => {
  await requireRole(["teacher", "admin"])(ctx);
  const { ids } = await req.json();
  if (!Array.isArray(ids) || !ids.length) return Response.json({ error: "No ids given" }, { status: 400 });
  const { error } = await ctx.supabaseAdmin.from("submissions").delete().in("id", ids);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, deleted: ids.length });
});

// ── GET /api/admin/export-csv ───────────────────────────────────
const exportCsvHandler = withSupabase({ auth: "user" }, async (_req, ctx) => {
  await requireRole(["teacher", "admin"])(ctx);
  const { data: rows, error } = await ctx.supabaseAdmin
    .from("submissions")
    .select("id, uploader_id, section_id, category, ai_status, ai_score, ai_provider, submitted_at, profiles(email, full_name)")
    .order("submitted_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const header = "student_email,student_name,section,category,ai_status,ai_score,ai_provider,submitted_at\n";
  const csvEscape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map(r => [
    r.profiles?.email, r.profiles?.full_name, r.section_id, r.category,
    r.ai_status, r.ai_score, r.ai_provider, r.submitted_at
  ].map(csvEscape).join(",")).join("\n");

  return new Response(header + body, {
    headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=submissions.csv" }
  });
});

// ── GET/POST /api/admin/config ──────────────────────────────────
// Provider *labels* only — real keys stay in Render env vars, never in the DB.
const configHandler = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method === "GET") {
    const { data } = await ctx.supabase.from("config").select("*").eq("key", "ai_provider").single();
    return Response.json({ config: data?.value || {} });
  }
  await requireRole(["admin"])(ctx);
  const { primary, fallback } = await req.json();
  const { error } = await ctx.supabaseAdmin.from("config")
    .update({ value: { primary, fallback }, updated_at: new Date().toISOString() })
    .eq("key", "ai_provider");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
});

// ── POST /api/notify/new-submission ─────────────────────────────
// Body: { submissionId }. Called by the frontend right after a student
// uploads/re-uploads a section. Notifies every teacher/admin so the queue
// doesn't rely on someone remembering to check back.
const newSubmissionNotifyHandler = withSupabase({ auth: "user" }, async (req, ctx) => {
  const { data: userRes } = await ctx.supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { submissionId } = await req.json();
  const { data: sub } = await ctx.supabaseAdmin
    .from("submissions").select("uploader_id, group_id, section_id").eq("id", submissionId).single();
  if (!sub) return Response.json({ error: "Submission not found" }, { status: 404 });

  // Caller must be the uploader or a member of the same group.
  let authorized = sub.uploader_id === uid;
  if (!authorized && sub.group_id) {
    const { data: me } = await ctx.supabaseAdmin.from("profiles").select("group_id").eq("id", uid).single();
    authorized = me?.group_id === sub.group_id;
  }
  if (!authorized) return Response.json({ error: "Not your submission" }, { status: 403 });

  const { data: uploaderProfile } = await ctx.supabaseAdmin
    .from("profiles").select("full_name, email").eq("id", sub.uploader_id).single();
  const { data: teachers } = await ctx.supabaseAdmin
    .from("profiles").select("id, email").in("role", ["teacher", "admin"]);

  const label = SECTIONS.find(s => s.id === sub.section_id)?.label || sub.section_id;
  const who = uploaderProfile?.full_name || uploaderProfile?.email || "A student";

  await notifyMany(ctx.supabaseAdmin, (teachers || []).map(t => ({
    userId: t.id,
    type: "new_submission",
    title: `${who} uploaded "${label}" for review`,
    body: `Section: ${label}`,
    submissionId,
    email: t.email,
    emailHtml: emailShell(
      `New submission ready for review`,
      `<p>${who} uploaded a new "${label}" section.</p>`,
      "Open queue", APP_URL
    )
  })));

  return Response.json({ ok: true, notified: (teachers || []).length });
});

// ── GET/POST /api/config/deadlines ──────────────────────────────
// Per-section due dates, e.g. { "abstract": "2026-07-15", ... }.
// Any authenticated user can read them (needed to show the overdue
// banner); only teacher/admin can change them.
const deadlinesHandler = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method === "GET") {
    const { data } = await ctx.supabase.from("config").select("value").eq("key", "deadlines").maybeSingle();
    return Response.json({ deadlines: data?.value || {} });
  }
  await requireRole(["teacher", "admin"])(ctx);
  const deadlines = await req.json();
  const { error } = await ctx.supabaseAdmin.from("config")
    .upsert({ key: "deadlines", value: deadlines, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
});

// ── POST /api/cron/deadline-reminders ───────────────────────────
// Not called by the frontend at all — point a Render Cron Job (or any
// scheduler that can hit an HTTPS URL) at this once a day. Protected by
// a shared secret instead of a user session since no one is logged in
// when a cron job fires.
//
// Render setup: New -> Cron Job -> same repo -> schedule e.g. "0 1 * * *"
// -> command: curl -X POST https://<your-service>.onrender.com/api/cron/deadline-reminders
//   -H "X-Cron-Secret: $CRON_SECRET"
// (set CRON_SECRET to the same value in both this service's env and the
// cron job's env).
async function deadlineReminderCron(req) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  // Built directly with supabase-js (bypassing the withSupabase wrapper,
  // which expects a logged-in user session — a cron job has none) using
  // the service-role key, same as ctx.supabaseAdmin uses elsewhere.
  // NOTE: confirm these env var names match whatever @supabase/server
  // reads internally — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is the
  // standard Supabase convention, but adjust if your setup differs.
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: deadlineCfg } = await supabaseAdmin.from("config").select("value").eq("key", "deadlines").maybeSingle();
  const deadlines = deadlineCfg?.value || {};
  const today = new Date();
  const dueSoon = SECTIONS.filter(s => {
    const d = deadlines[s.id];
    if (!d) return false;
    const days = (new Date(d) - today) / 86400000;
    return days >= 0 && days <= 3; // remind starting 3 days out
  });
  if (!dueSoon.length) return Response.json({ ok: true, reminded: 0 });

  const { data: allSubs } = await supabaseAdmin.from("submissions").select("uploader_id, section_id, ai_status");
  const { data: students } = await supabaseAdmin.from("profiles").select("id, email, full_name").eq("role", "student").eq("approved", true);

  let count = 0;
  for (const student of students || []) {
    const missing = dueSoon.filter(s => {
      const sub = (allSubs || []).find(x => x.uploader_id === student.id && x.section_id === s.id);
      return !sub || sub.ai_status !== "approved";
    });
    if (!missing.length) continue;
    await notify(supabaseAdmin, {
      userId: student.id,
      type: "deadline_reminder",
      title: `Deadline reminder: ${missing.map(m => m.label).join(", ")}`,
      body: `These sections are due soon and not yet approved.`,
      email: student.email,
      emailHtml: emailShell(
        "Sections due soon",
        `<p>The following section(s) are due soon and not yet approved:</p><ul>${missing.map(m => `<li>${m.label}</li>`).join("")}</ul>`,
        "Upload now", APP_URL
      )
    });
    count++;
  }
  return Response.json({ ok: true, reminded: count });
}

const ROUTES = {
  "POST /api/grade": gradeHandler,
  "POST /api/admin/teacher-verdict": teacherVerdictHandler,
  "POST /api/admin/set-approval": setApprovalHandler,
  "POST /api/admin/set-role": setRoleHandler,
  "POST /api/admin/bulk-delete": bulkDeleteHandler,
  "GET /api/admin/export-csv": exportCsvHandler,
  "GET /api/admin/config": configHandler,
  "POST /api/admin/config": configHandler,
  "POST /api/notify/new-submission": newSubmissionNotifyHandler,
  "GET /api/config/deadlines": deadlinesHandler,
  "POST /api/config/deadlines": deadlinesHandler,
  "POST /api/cron/deadline-reminders": deadlineReminderCron
};

// ── Node http <-> Web Fetch adapter ─────────────────────────────
// withSupabase expects a standard Fetch API Request/Response (per the
// documented "export default { fetch }" pattern). Node 18+ has global
// Request/Response, so we bridge http.IncomingMessage to that here rather
// than depending on a separate edge runtime.
const server = createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/healthz") {
    res.writeHead(200, { ...headers, "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const routeKey = `${req.method} ${url.pathname}`;
  const handler = ROUTES[routeKey];
  if (!handler) {
    res.writeHead(404, headers);
    res.end("Not found");
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const bodyBuf = Buffer.concat(chunks);

  const fetchReq = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : bodyBuf
  });

  try {
    const fetchRes = await handler(fetchReq);
    const text = await fetchRes.text();

    // IMPORTANT: fetchRes.headers (a Fetch API Headers object) always
    // lowercases header names when iterated. Our own `headers` object uses
    // PascalCase keys (e.g. "Access-Control-Allow-Origin"). Spreading both
    // into one object without normalizing case means BOTH survive as
    // distinct keys, and res.writeHead ends up sending two separate
    // Access-Control-Allow-Origin headers — which browsers reject outright.
    // Strip any CORS-related headers coming from the handler's response and
    // let our own `headers` (computed from ALLOWED_ORIGINS) always win.
    const upstreamHeaders = Object.fromEntries(fetchRes.headers);
    delete upstreamHeaders["access-control-allow-origin"];
    delete upstreamHeaders["access-control-allow-headers"];
    delete upstreamHeaders["access-control-allow-methods"];
    delete upstreamHeaders["vary"];

    res.writeHead(fetchRes.status, { ...upstreamHeaders, ...headers });
    res.end(text);
  } catch (e) {
    const status = e.status || 500;
    res.writeHead(status, { ...headers, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: e.message || "Server error" }));
  }
});

server.listen(PORT, () => console.log(`E-Tuklas Checker backend listening on :${PORT}`));
