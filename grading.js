// ════════════════════════════════════════════════════
// AI grading — the prompt below is unchanged from the original
// E-Tuklas Online Checker. Do not edit the rubric/scoring rules
// without the same review the original prompt went through.
// ════════════════════════════════════════════════════

export const SECTIONS = [
  { id: "abstract", label: "Abstract" },
  { id: "rationale", label: "Rationale / Background of the Study" },
  { id: "methodology", label: "Methodology" },
  // ── Added from CRITERIA.docx — each has its own weighted rubric below
  // in SECTION_CRITERIA, not the generic 4-criteria one used above.
  { id: "research_questions", label: "Research Questions (SMART)" },
  { id: "research_objectives", label: "Research Objectives" },
  { id: "hypotheses", label: "Hypotheses" },
  { id: "theoretical_framework", label: "Theoretical Framework" },
  { id: "conceptual_framework", label: "Conceptual Framework" },
  { id: "scope_limitations", label: "Scope and Limitations" },
  { id: "significance", label: "Significance of the Study" },
  { id: "definition_of_terms", label: "Definition of Terms" },
  { id: "statistical_analysis", label: "Statistical Analysis" },
  { id: "bibliography", label: "Bibliography" }
];

export const CATEGORIES = [
  "Life Science",
  "Mathematical and Computational Science",
  "Physical Science",
  "Robotics and Intelligent Machines",
  "Innovation Expo"
];

// ════════════════════════════════════════════════════
// Section-specific rubrics, transcribed verbatim (criterion wording and
// point values) from CRITERIA.docx. Sections not listed here (abstract,
// rationale, methodology) keep using the generic DEFAULT_CRITERIA rubric
// below, untouched.
//
// Also from CRITERIA.docx: the "Performance Rating Scale" used to turn a
// 0-100 score into a band + descriptor. It's stricter than the old
// approve-at-80 rule (fairly-satisfactory tops out at 79), so status here
// is computed in code from scorePercent rather than left to the model —
// see scoreToBand() below.
// ════════════════════════════════════════════════════
const SECTION_CRITERIA = {
  research_questions: [
    { name: "Problem Definition", max: 25, desc: "Research questions clearly define the scientific problem or phenomenon to be investigated." },
    { name: "Specificity & Measurability", max: 25, desc: "Research questions are specific, measurable, and investigable using scientific methods." },
    { name: "Feasibility", max: 20, desc: "Research questions are feasible within the available resources, time, and research setting." },
    { name: "Alignment with Objectives", max: 20, desc: "Research questions are aligned with the objectives and significance of the study." },
    { name: "Originality & Relevance", max: 10, desc: "Research questions demonstrate originality and relevance to a real-world scientific issue or community need." }
  ],
  research_objectives: [
    { name: "Alignment with Problem", max: 30, desc: "Objectives are directly aligned with the research problem and questions." },
    { name: "Specific & Achievable", max: 25, desc: "Objectives are specific, measurable, and achievable." },
    { name: "Defines the Investigation", max: 20, desc: "Objectives clearly define the intended scientific investigation." },
    { name: "Logical Sequencing", max: 15, desc: "Objectives are logically sequenced from the general objective to the specific objectives." },
    { name: "Action Verbs", max: 10, desc: "Appropriate research action verbs are consistently used." }
  ],
  hypotheses: [
    { name: "Logical Derivation", max: 30, desc: "Hypotheses are logically derived from the research problem and review of related literature." },
    { name: "Testability", max: 30, desc: "Hypotheses are scientifically testable and measurable." },
    { name: "Variable Relationships", max: 20, desc: "Hypotheses clearly identify the relationship among variables." },
    { name: "Null/Alternative Formulation", max: 20, desc: "Null and alternative hypotheses are correctly formulated, when applicable." }
  ],
  theoretical_framework: [
    { name: "Theory Identification", max: 25, desc: "Appropriate scientific theory is identified." },
    { name: "Scholarly Explanation", max: 25, desc: "Theory is accurately explained using scholarly sources." },
    { name: "Sound Foundation", max: 30, desc: "Theory provides a sound foundation for the investigation." },
    { name: "Coherence & Accuracy", max: 20, desc: "Discussion demonstrates coherence, logical flow, and scientific accuracy." }
  ],
  conceptual_framework: [
    { name: "Variable Identification", max: 25, desc: "Variables are correctly identified and defined." },
    { name: "Illustrated Relationships", max: 30, desc: "Relationships among variables are logically illustrated." },
    { name: "Represents the Process", max: 25, desc: "Framework accurately represents the research process or paradigm." },
    { name: "Narrative Support", max: 20, desc: "Narrative explanation clearly supports the framework." }
  ],
  scope_limitations: [
    { name: "Coverage & Boundaries", max: 35, desc: "Clearly defines the coverage and boundaries of the investigation." },
    { name: "Realistic Limitations", max: 25, desc: "Limitations are realistic and scientifically justified." },
    { name: "Feasibility", max: 25, desc: "Study is feasible considering available resources, time, and ethical requirements." },
    { name: "Organization", max: 15, desc: "Discussion is well-organized and coherent." }
  ],
  significance: [
    { name: "Beneficiaries Identified", max: 20, desc: "Clearly identifies the intended beneficiaries or stakeholders." },
    { name: "Demonstrates Significance", max: 35, desc: "Demonstrates the scientific, educational, environmental, or societal significance of the study." },
    { name: "Contribution Explained", max: 30, desc: "Clearly explains the potential contribution to scientific knowledge or problem-solving." },
    { name: "Organization", max: 15, desc: "Discussion is logically organized and clearly presented." }
  ],
  definition_of_terms: [
    { name: "Term Coverage", max: 25, desc: "Significant technical and scientific terms are included." },
    { name: "Conceptual Definitions", max: 25, desc: "Conceptual definitions are based on credible scientific references." },
    { name: "Operational Definitions", max: 35, desc: "Operational definitions are appropriate to the conduct of the study." },
    { name: "Organization & Consistency", max: 15, desc: "Entries are clearly organized and consistently presented." }
  ],
  statistical_analysis: [
    { name: "Appropriate Tools", max: 35, desc: "Statistical tools are appropriate for the research design and type of data." },
    { name: "Addresses Objectives", max: 30, desc: "Statistical procedures adequately address the research objectives and hypotheses." },
    { name: "Justification", max: 20, desc: "Selection of statistical techniques is scientifically justified." },
    { name: "Clear Description", max: 15, desc: "Statistical procedures are clearly described and correctly presented." }
  ],
  bibliography: [
    { name: "Credible Sources", max: 30, desc: "References are obtained from credible, peer-reviewed, or authoritative sources." },
    { name: "Currency & Relevance", max: 20, desc: "References are current and relevant to the study." },
    { name: "APA 7 Compliance", max: 35, desc: "Citations and references consistently follow APA 7th Edition guidelines." },
    { name: "Completeness & Formatting", max: 15, desc: "Reference list is complete, accurate, and consistently formatted." }
  ]
};

const PERFORMANCE_BANDS = [
  { min: 90, label: "Outstanding", status: "approved", desc: "Exceeds the standards for a Science Investigatory Project. The section demonstrates exceptional scientific rigor, coherence, originality, and adherence to accepted research principles with minimal or no revisions required." },
  { min: 85, label: "Very Satisfactory", status: "approved", desc: "Meets the expected standards for a Science Investigatory Project. The section is scientifically sound and well-developed, requiring only minor refinements to improve clarity or precision." },
  { min: 80, label: "Satisfactory", status: "approved", desc: "Adequately meets the required standards. The section demonstrates acceptable scientific quality but requires moderate revisions to strengthen its completeness, organization, or technical accuracy." },
  { min: 75, label: "Fairly Satisfactory", status: "needs_revision", desc: "Partially meets the expected standards. Significant revisions are necessary to improve scientific quality, organization, and alignment with the research objectives." },
  { min: 0, label: "Needs Improvement", status: "rejected", desc: "Does not satisfy the minimum standards for a Science Investigatory Project. Extensive revision and substantial improvement are required before the section can be considered acceptable." }
];

function scoreToBand(scorePercent) {
  return PERFORMANCE_BANDS.find(b => scorePercent >= b.min) || PERFORMANCE_BANDS[PERFORMANCE_BANDS.length - 1];
}

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

function buildSpecificPrompt(sectionLabel, criteria, text) {
  const criteriaBlock = criteria
    .map((c, i) => `${i + 1}. ${c.name} (${c.max} pts) — ${c.desc}`)
    .join("\n");
  const jsonCriteria = criteria
    .map(c => `{"name":"${c.name}","score":0,"max":${c.max},"note":"specific, honest observation citing this text"}`)
    .join(",");
  const bandsBlock = [
    `- 90-100 "Outstanding": ${PERFORMANCE_BANDS[0].desc}`,
    `- 85-89 "Very Satisfactory": ${PERFORMANCE_BANDS[1].desc}`,
    `- 80-84 "Satisfactory": ${PERFORMANCE_BANDS[2].desc}`,
    `- 75-79 "Fairly Satisfactory": ${PERFORMANCE_BANDS[3].desc}`,
    `- Below 75 "Needs Improvement": ${PERFORMANCE_BANDS[4].desc}`
  ].join("\n");

  return `
You are the official AI reviewer for E-Tuklas, a Philippine Junior High School
(Grade 8-10) research portal. You are grading ONLY the "${sectionLabel}"
section of a student research paper, against the school's official rubric
for this exact section. This grade is shown directly to the student and to
their teacher, and the teacher may revise it afterward — so it must be
seriously honest, specific, and fair. Do not be falsely encouraging and do
not be needlessly harsh. Grade exactly what is on the page.

Score these criteria (points as shown, ${criteria.reduce((s, c) => s + c.max, 0)} total):
${criteriaBlock}

Use the FULL point range on each criterion — do not default to a
comfortable middling score out of politeness. A typical first-attempt JHS
submission should NOT automatically land near the top of the range.

CRITICAL RULES:
1. For every criterion NOT scoring full marks, the "note" MUST name a
   specific, concrete issue — quote or closely paraphrase the actual
   problematic phrase, sentence, or missing element from the text below. A
   note that could apply to any random submission (e.g. "could be
   clearer," "good effort") without pointing at anything specific in THIS
   text is not acceptable.
2. Two different submissions of different actual quality MUST receive
   meaningfully different scores.
3. "note" should be 1-2 full sentences — one specific, actionable
   observation, not just a rating restated in words.

Total the criteria scores into scorePercent (0-100). scorePercent MUST
equal the sum of the criteria scores.

For reference only (do not include this text in your response), the
school's performance bands for this total are:
${bandsBlock}

Respond ONLY in this exact JSON shape, no markdown fences, no preamble:
{"scorePercent":0,"criteria":[${jsonCriteria}],"remarks":"2-4 sentences: a direct, specific, honest summary of what is good and exactly what needs to change, written for a Grade 8-10 student to act on"}

Be consistent: the same quality of writing should get the same grade every
time — but different quality writing MUST get different grades. Do not
invent praise that isn't earned and do not invent flaws that aren't there.

SECTION TEXT TO REVIEW:
"""
${text.slice(0, 12000)}
"""
`.trim();
}

function parseVerdict(raw) {
  let cleaned = raw.trim()
    .replace(/^```json\s*|^```\s*|```$/g, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  // "status" is required for the original abstract/rationale/methodology
  // rubric (the model is asked for it directly there). The newer
  // section-specific rubric doesn't ask the model for status — reviewSection
  // fills it in deterministically from scorePercent instead — so it's not
  // validated here.
  if (typeof parsed.scorePercent !== "number" || !Array.isArray(parsed.criteria)) {
    throw new Error("AI verdict missing required fields");
  }
  return parsed;
}

// ── Shared helper for OpenAI-compatible chat/completions endpoints ──
// Groq, OpenAI, Mistral, Cerebras, and OpenRouter all speak this same
// request/response shape, so one helper covers all of them.
async function callOpenAICompatible({ url, apiKey, model, prompt, extraHeaders, providerLabel }) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      ...(extraHeaders || {})
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) {
    let bodyText = "";
    try { bodyText = await res.text(); } catch (e) {}
    console.error(`[${providerLabel}] request failed (${res.status}):`, bodyText);
    const err = new Error(`${providerLabel} request failed (${res.status}): ${bodyText}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  return parseVerdict(text);
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
  return callOpenAICompatible({
    url: "https://api.groq.com/openai/v1/chat/completions",
    apiKey,
    model: "llama-3.3-70b-versatile",
    prompt,
    providerLabel: "Groq"
  });
}

async function callOpenAI(prompt, apiKey) {
  return callOpenAICompatible({
    url: "https://api.openai.com/v1/chat/completions",
    apiKey,
    model: "gpt-4o-mini",
    prompt,
    providerLabel: "OpenAI"
  });
}

async function callMistral(prompt, apiKey) {
  return callOpenAICompatible({
    url: "https://api.mistral.ai/v1/chat/completions",
    apiKey,
    // "mistral-small-latest" is the current lightweight tier on the free
    // "Experiment" plan. Check console.mistral.ai if this model is retired.
    model: "mistral-small-latest",
    prompt,
    providerLabel: "Mistral"
  });
}

async function callCerebras(prompt, apiKey) {
  return callOpenAICompatible({
    url: "https://api.cerebras.ai/v1/chat/completions",
    apiKey,
    // Cerebras's free-tier model catalog changes without much notice —
    // verify this model is still active at cloud.cerebras.ai if you start
    // seeing 404s instead of the usual 429/403 quota errors.
    model: "llama-3.3-70b",
    prompt,
    providerLabel: "Cerebras"
  });
}

async function callOpenRouter(prompt, apiKey) {
  return callOpenAICompatible({
    url: "https://openrouter.ai/api/v1/chat/completions",
    apiKey,
    // The ":free" suffix routes to OpenRouter's no-cost model pool.
    // Swap this if the specific model is deprecated — check openrouter.ai/models.
    model: "meta-llama/llama-3.3-70b-instruct:free",
    prompt,
    // OpenRouter asks for these to attribute/rank free-tier traffic; not
    // strictly required but recommended so your app doesn't get deprioritized.
    extraHeaders: {
      "HTTP-Referer": "https://sabnahis-ste.github.io",
      "X-Title": "E-Tuklas Online Checker"
    },
    providerLabel: "OpenRouter"
  });
}

const isQuotaError = (err) => err.status === 429 || err.status === 403;

const PROVIDERS = {
  gemini: { call: callGemini, keyEnv: "GEMINI_API_KEY" },
  groq: { call: callGroq, keyEnv: "GROQ_API_KEY" },
  openai: { call: callOpenAI, keyEnv: "OPENAI_API_KEY" },
  mistral: { call: callMistral, keyEnv: "MISTRAL_API_KEY" },
  cerebras: { call: callCerebras, keyEnv: "CEREBRAS_API_KEY" },
  openrouter: { call: callOpenRouter, keyEnv: "OPENROUTER_API_KEY" }
};

// Order used to fill out the rest of the chain after primary/fallback.
// Free-tier friendly providers first, since those are most likely to be
// the ones actually configured with a key.
const DEFAULT_CHAIN_ORDER = ["gemini", "groq", "openrouter", "mistral", "cerebras", "openai"];

/**
 * Grades a section by walking an ordered chain of providers, moving to the
 * next provider only on a quota/rate-limit error (429/403) — an
 * arbitrary-failure fallback would silently swap models mid-stream and
 * reintroduce "same abstract, different score" inconsistency. On any other
 * error it retries the same provider with backoff before giving up on it.
 *
 * config: { primary: providerName, fallback: providerName, chain: [providerName, ...] }
 * - If config.chain is given, it's used as-is (only known provider names, keys present).
 * - Otherwise the chain is built from config.primary + config.fallback, followed by
 *   any remaining known providers in DEFAULT_CHAIN_ORDER, so a single provider's
 *   outage never fully stalls grading as long as ANY key is configured.
 * - Providers without an API key set in the environment are skipped entirely.
 */
export async function reviewSection(sectionId, sectionLabel, text, config) {
  const specificCriteria = SECTION_CRITERIA[sectionId];
  const prompt = specificCriteria
    ? buildSpecificPrompt(sectionLabel, specificCriteria, text)
    : buildPrompt(sectionLabel, text);

  let chain;
  if (Array.isArray(config?.chain) && config.chain.length) {
    chain = config.chain.filter(name => PROVIDERS[name]);
  } else {
    const primaryName = config?.primary && PROVIDERS[config.primary] ? config.primary : "gemini";
    const fallbackName = config?.fallback && PROVIDERS[config.fallback] ? config.fallback : "groq";
    const rest = DEFAULT_CHAIN_ORDER.filter(name => name !== primaryName && name !== fallbackName);
    chain = [primaryName, fallbackName, ...rest];
  }

  // Only attempt providers that actually have a key configured.
  chain = chain.filter(name => process.env[PROVIDERS[name].keyEnv]);
  if (!chain.length) {
    throw new Error("No AI provider API keys are configured");
  }

  let lastErr;
  for (const providerName of chain) {
    const provider = PROVIDERS[providerName];
    const apiKey = process.env[provider.keyEnv];

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const verdict = await provider.call(prompt, apiKey);
        if (specificCriteria) {
          const band = scoreToBand(verdict.scorePercent);
          return { ...verdict, status: band.status, ratingLabel: band.label, provider: providerName };
        }
        return { ...verdict, provider: providerName };
      } catch (e) {
        lastErr = e;
        if (isQuotaError(e)) break; // don't waste a retry on this provider, move to the next
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    // Loop continues to the next provider in the chain regardless of why
    // this one failed (quota exhausted OR repeated non-quota errors).
  }

  throw lastErr;
}
