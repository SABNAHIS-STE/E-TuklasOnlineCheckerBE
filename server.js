import { createServer } from "node:http";
import { withSupabase } from "@supabase/server";
import { reviewSection, SECTIONS } from "./grading.js";

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
    verdict = await reviewSection(section.label, text);
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

const ROUTES = {
  "POST /api/grade": gradeHandler,
  "POST /api/admin/teacher-verdict": teacherVerdictHandler,
  "POST /api/admin/set-approval": setApprovalHandler,
  "POST /api/admin/set-role": setRoleHandler,
  "POST /api/admin/bulk-delete": bulkDeleteHandler,
  "GET /api/admin/export-csv": exportCsvHandler,
  "GET /api/admin/config": configHandler,
  "POST /api/admin/config": configHandler
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
    const resHeaders = Object.fromEntries(fetchRes.headers);
    delete resHeaders["access-control-allow-origin"];
    res.writeHead(fetchRes.status, { ...resHeaders, ...headers });
    res.end(text);
  } catch (e) {
    const status = e.status || 500;
    res.writeHead(status, { ...headers, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: e.message || "Server error" }));
  }
});

server.listen(PORT, () => console.log(`E-Tuklas Checker backend listening on :${PORT}`));
