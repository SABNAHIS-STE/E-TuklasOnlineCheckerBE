// ════════════════════════════════════════════════════
// aiDetector.js — an LLM-based "possible AI writing" signal.
//
// WHAT THIS IS: one LLM's stylistic read of a section, reused from the
// same provider chain as grading.js (runChain), asked to reason about
// AI-typical tells (uniform sentence rhythm, generic transitions, absence
// of specific/local detail, unnaturally even paragraph structure, etc.)
// and return a coarse band — low / medium / high — plus one grounded
// reason.
//
// WHAT THIS IS NOT: it is NOT ZeroGPT, Turnitin, or QuillBot. It does not
// call any of those services (no public API exists for any of them that
// this app has access to), and it must never be labeled with their names
// anywhere in the UI, database, or exports. It is a single model's guess.
// Guesses like this are known to be wrong in both directions — including
// false positives on non-native English writers, which is exactly this
// app's student population. It exists to give a teacher one more thing to
// glance at, never to auto-penalize a student or affect ai_status/ai_score.
//
// This module NEVER throws in a way that should block a grade write —
// callers should treat it as best-effort, same pattern as notify().
// ════════════════════════════════════════════════════

import { runChain } from "./grading.js";

const VALID_LIKELIHOODS = ["low", "medium", "high"];
const MIN_CHARS_FOR_ASSESSMENT = 300; // below this, any verdict is just noise

function buildDetectionPrompt(sectionLabel, text) {
  return `
You are giving ONE teacher-facing signal about a Philippine Junior High
School (Grade 8-10) student's "${sectionLabel}" section: how likely is it,
based on writing style alone, that some or all of this text was generated
or heavily rewritten by an AI language model rather than written by the
student.

This is NOT a plagiarism check and NOT a verdict — you cannot actually
prove AI authorship from style alone, and you will often be wrong. Be
honest about that uncertainty rather than sounding confident. Do NOT
default to "high" just because writing is polished — competent JHS
students write well too, and many are non-native English speakers whose
careful, formal phrasing can look "unnaturally clean" without being
AI-written. Only lean toward "medium" or "high" when you see multiple
concrete stylistic tells, not just "it's well written."

Signals that CAN indicate AI involvement (not proof on their own):
- Uniform sentence length/rhythm with little natural variation
- Generic academic transitions used repetitively ("Furthermore," "In
  conclusion," "It is important to note that") without any voice
- Content that is vague/generic where a real student study would have
  specific local detail (actual measurements, actual place names, actual
  numbers, actual difficulties encountered)
- Suspiciously even, symmetric paragraph lengths throughout
- Vocabulary or sentence complexity that is inconsistent with the rest of
  the same student's other sections, if visible in this text

Signals that argue AGAINST AI involvement:
- Specific, concrete, idiosyncratic details a generic model would be
  unlikely to invent (actual local context, actual numbers, hedging or
  awkwardness typical of a learner's genuine voice)
- Natural inconsistency in structure/tone across the passage

Respond ONLY in this exact JSON shape, no markdown fences, no preamble:
{"likelihood":"low"|"medium"|"high","confidencePercent":<multiple of 10, 0-100>,"reason":"one or two sentences, grounded in something specific you can point to in THIS text (quote or closely paraphrase it) — never a generic statement that could apply to any submission"}

confidencePercent is YOUR rough self-rated confidence that this text involved AI writing, rounded to the nearest 10 (0, 10, 20 ... 100). It is a coarse gut-check, not a precise measurement — do not reason as if finer granularity than that would mean anything.

SECTION TEXT:
"""
${text.slice(0, 12000)}
"""
`.trim();
}

function parseDetection(raw) {
  const cleaned = raw.trim()
    .replace(/^```json\s*|^```\s*|```$/g, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  if (!VALID_LIKELIHOODS.includes(parsed.likelihood) || typeof parsed.reason !== "string" || !parsed.reason.trim()) {
    throw new Error("AI-likelihood response missing required fields");
  }
  let pct = Number(parsed.confidencePercent);
  if (!Number.isFinite(pct)) pct = null;
  else pct = Math.min(100, Math.max(0, Math.round(pct / 10) * 10)); // clamp + force nearest-10 even if the model drifts
  return { likelihood: parsed.likelihood, reason: parsed.reason.trim(), confidencePercent: pct };
}

/**
 * Returns a teacher-facing, honestly-hedged AI-likelihood estimate for a
 * section of text, or null if the text is too short to say anything
 * meaningful. Callers must treat this as advisory only — never wire it
 * into ai_status, ai_score, or any student-facing accusation.
 *
 * Return shape: { likelihood: "low"|"medium"|"high", reason, provider, checkedAt }
 */
export async function assessAiLikelihood(sectionLabel, text, config) {
  if (!text || text.trim().length < MIN_CHARS_FOR_ASSESSMENT) {
    return null; // not enough signal either way — say nothing rather than guess
  }
  const prompt = buildDetectionPrompt(sectionLabel, text);
  const { rawText, provider } = await runChain(prompt, config);
  const { likelihood, reason, confidencePercent } = parseDetection(rawText);
  return { likelihood, reason, confidencePercent, provider, checkedAt: new Date().toISOString() };
}
