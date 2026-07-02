// ════════════════════════════════════════════════════
// mailer.js — sends transactional email via Resend
// (https://resend.com). Chosen because it's a plain HTTPS
// POST — no SMTP ports to worry about on Render, no extra
// npm dependency, generous free tier (100 emails/day,
// 3,000/month as of writing).
//
// Setup on Render:
//   1. Sign up at resend.com, verify a sending domain (or
//      use their sandbox address for testing — sandbox mail
//      only delivers to the email on your Resend account).
//   2. Create an API key, set it as RESEND_API_KEY in your
//      Render environment variables.
//   3. Optionally set NOTIFY_FROM_EMAIL, e.g.
//      "E-Tuklas Checker <notifications@yourdomain.com>".
//      Defaults to Resend's shared sandbox sender, which
//      only works for the account owner's own inbox.
// ════════════════════════════════════════════════════

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.NOTIFY_FROM_EMAIL || "E-Tuklas Checker <onboarding@resend.dev>";

/**
 * Sends a single email. Never throws — a failed/unconfigured email should
 * never take down a grading or notification flow. Errors are logged only.
 */
export async function sendEmail(to, subject, html) {
  if (!to) return;
  if (!RESEND_API_KEY) {
    console.warn(`[mailer] RESEND_API_KEY not set — skipping email "${subject}" to ${to}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[mailer] send failed (${res.status}) to ${to}:`, body);
    }
  } catch (e) {
    console.error("[mailer] send threw:", e.message);
  }
}

export function emailShell(title, bodyHtml, ctaLabel, ctaUrl) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#181a1f;">
    <h2 style="font-size:18px;margin:0 0 14px;">${title}</h2>
    <div style="font-size:14px;line-height:1.6;color:#3b3d44;">${bodyHtml}</div>
    ${ctaUrl ? `<div style="margin-top:22px;">
      <a href="${ctaUrl}" style="background:#0d8f7f;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">${ctaLabel || "Open E-Tuklas"}</a>
    </div>` : ""}
    <p style="margin-top:28px;font-size:11.5px;color:#9a9ba3;">E-Tuklas Online Checker — automated notification.</p>
  </div>`;
}
