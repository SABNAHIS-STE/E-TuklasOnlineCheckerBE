// ════════════════════════════════════════════════════
// AI grading — the prompt below is unchanged from the original
// E-Tuklas Online Checker. Do not edit the rubric/scoring rules
// without the same review the original prompt went through.
// ════════════════════════════════════════════════════

export const SECTIONS = [
  { id: "abstract", label: "Abstract" },
  { id: "rationale", label: "Rationale / Background of the Study" },
  { id: "methodology", label: "Methodology" }
];

export const CATEGORIES = [
  "Life Science",
  "Mathematical and Computational Science",
  "Physical Science",
  "Robotics and Intelligent Machines",
  "Innovation Expo"
];

const DEFAULT_CRITERIA = `
You are the official AI reviewer for E-Tuklas, a Philippine Junior High School
(Grade 8-10) research portal. You are grading ONLY the "{SECTION_LABEL}"
section of a student research paper. This grade is shown directly to the
student and to their teacher, and the teacher may revise it afterward — so it
must be seriously honest, specific, and fair. Do not be falsely encouraging
and do not be needlessly harsh. Grade exactly what is on the page.

Score these four criteria out of 25 points each (100 total):
1. Relevance — does the content actually belong in a "{SECTION_LABEL}" section
   and address what that section is supposed to cover, for a JHS-level study?
2. Coherence & Clarity — is it written in clear, logically ordered academic
   English or Filipino prose a Grade 8-10 reader could follow?
3. Completeness — does it cover what a "{SECTION_LABEL}" section needs (not
   padded, not a one-line stub, not copy-pasted instructions)?
4. Academic Tone & Mechanics — appropriate register, grammar, and structure
   for a school research submission (not casual chat text, not obvious
   placeholder/lorem ipsum).

Total the four scores into scorePercent (0-100). Decide status by total:
- 80-100: "approved"
- 50-79: "needs_revision"
- 0-49: "rejected"

Respond ONLY in this exact JSON shape, no markdown fences, no preamble:
{"status":"approved" | "needs_revision" | "rejected","scorePercent":0,"criteria":[{"name":"Relevance","score":0,"max":25,"note":"one short honest sentence"},{"name":"Coherence & Clarity","score":0,"max":25,"note":"one short honest sentence"},{"name":"Completeness","score":0,"max":25,"note":"one short honest sentence"},{"name":"Academic Tone & Mechanics","score":0,"max":25,"note":"one short honest sentence"}],"remarks":"2-4 sentences: a direct, specific, honest summary of what is good and exactly what needs to change, written for a Grade 8-10 student to act on"}

scorePercent MUST equal the sum of the four criteria scores. Be consistent:
the same quality of writing should get the same grade every time. Do not
invent praise that isn't earned and do not invent flaws that aren't there.

SECTION TEXT TO REVIEW:
"""
{TEXT}
"""
`.trim();

function buildPrompt(sectionLabel, text) {
  return DEFAULT_CRITERIA
    .replaceAll("{SECTION_LABEL}", sectionLabel)
    .replace("{TEXT}", text.slice(0, 12000));
}

function parseVerdict(raw) {
  let cleaned = raw.trim()
    .replace(/^```json\s*|^```\s*|```$/g, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed.status || typeof parsed.scorePercent !== "number" || !Array.isArray(parsed.criteria)) {
    throw new Error("AI verdict missing required fields");
  }
  return parsed;
}

async function callGemini(prompt, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0 }
      })
    }
  );
  if (!res.ok) {
    const err = new Error(`Gemini request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return parseVerdict(text);
}

async function callGroq(prompt, apiKey) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) {
    const err = new Error(`Groq request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  return parseVerdict(text);
}

async function callOpenAI(prompt, apiKey) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) {
    let bodyText = "";
    try { bodyText = await res.text(); } catch (e) {}
    console.error(`[openai] request failed (${res.status}):`, bodyText);
    const err = new Error(`OpenAI request failed (${res.status}): ${bodyText}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  return parseVerdict(text);
}

const isQuotaError = (err) => err.status === 429 || err.status === 403;

const PROVIDERS = {
  gemini: { call: callGemini, keyEnv: "GEMINI_API_KEY" },
  groq: { call: callGroq, keyEnv: "GROQ_API_KEY" },
  openai: { call: callOpenAI, keyEnv: "OPENAI_API_KEY" }
};

/**
 * Grades a section using the configured primary provider, falling back to
 * the configured fallback provider only on a quota/rate-limit error
 * (429/403) — an arbitrary-failure fallback would silently swap models
 * mid-stream and reintroduce "same abstract, different score" inconsistency.
 * On any other error it retries the same provider with backoff instead.
 *
 * config: { primary: "gemini"|"groq"|"openai", fallback: "gemini"|"groq"|"openai" }
 * Defaults to gemini -> groq if no config is given (backwards compatible).
 */
export async function reviewSection(sectionLabel, text, config) {
  const prompt = buildPrompt(sectionLabel, text);
  const primaryName = config?.primary && PROVIDERS[config.primary] ? config.primary : "gemini";
  const fallbackName = config?.fallback && PROVIDERS[config.fallback] ? config.fallback : "groq";

  const primary = PROVIDERS[primaryName];
  const primaryKey = process.env[primary.keyEnv];

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const verdict = await primary.call(prompt, primaryKey);
      return { ...verdict, provider: primaryName };
    } catch (e) {
      lastErr = e;
      if (isQuotaError(e)) break; // don't waste a retry, go straight to fallback
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }

  if (isQuotaError(lastErr) && fallbackName !== primaryName) {
    const fallback = PROVIDERS[fallbackName];
    const fallbackKey = process.env[fallback.keyEnv];
    if (fallbackKey) {
      const verdict = await fallback.call(prompt, fallbackKey);
      return { ...verdict, provider: fallbackName };
    }
  }

  throw lastErr;
}
