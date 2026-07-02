// ════════════════════════════════════════════════════
// notifications.js — writes an in-app notification row
// (read by the frontend's notification bell via Supabase +
// RLS) and, optionally, fires the matching email.
//
// Requires the `notifications` table — see the SQL in
// supabase-notifications.sql. Inserts always use the admin
// (service-role) client since regular users are only granted
// SELECT/UPDATE on their own rows, never INSERT.
// ════════════════════════════════════════════════════

import { sendEmail } from "./mailer.js";

/**
 * @param supabaseAdmin  the service-role Supabase client (bypasses RLS)
 * @param {object} n
 * @param n.userId        recipient's profiles.id
 * @param n.type          "graded" | "teacher_override" | "new_submission" | "deadline_reminder"
 * @param n.title         short line shown in the bell dropdown
 * @param n.body          longer detail line
 * @param n.submissionId  optional, links the notification to a submission
 * @param n.email         recipient's email address (skip email if omitted)
 * @param n.emailHtml     full HTML body for the email (falls back to body)
 */
export async function notify(supabaseAdmin, n) {
  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id: n.userId,
    type: n.type,
    title: n.title,
    body: n.body || null,
    submission_id: n.submissionId || null
  });
  if (error) console.error("[notifications] insert failed:", error.message);

  if (n.email) {
    await sendEmail(n.email, n.title, n.emailHtml || `<p>${n.body || n.title}</p>`);
  }
}

export async function notifyMany(supabaseAdmin, recipients) {
  await Promise.all(recipients.map(r => notify(supabaseAdmin, r)));
}
