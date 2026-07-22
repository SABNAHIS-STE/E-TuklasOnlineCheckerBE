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
  return text;
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
  return text;
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
 * Walks an ordered chain of providers for a given prompt, moving to the next
 * provider only on a quota/rate-limit error (429/403) — an arbitrary-failure
 * fallback would silently swap models mid-stream. On any other error it
 * retries the same provider with backoff before giving up on it. Returns
 * the winning provider's raw text response (unparsed) plus which provider
 * produced it — callers decide how to parse/validate the response, since
 * grading verdicts and section-detection JSON have different shapes.
 *
 * config: { primary: providerName, fallback: providerName, chain: [providerName, ...] }
 * - If config.chain is given, it's used as-is (only known provider names, keys present).
 * - Otherwise the chain is built from config.primary + config.fallback, followed by
 *   any remaining known providers in DEFAULT_CHAIN_ORDER, so a single provider's
 *   outage never fully stalls grading as long as ANY key is configured.
 * - Providers without an API key set in the environment are skipped entirely.
 */
export async function runChain(prompt, config) {
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
        const rawText = await provider.call(prompt, apiKey);
        return { rawText, provider: providerName };
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

export async function reviewSection(sectionId, sectionLabel, text, config) {
  const specificCriteria = SECTION_CRITERIA[sectionId];
  const prompt = specificCriteria
    ? buildSpecificPrompt(sectionLabel, specificCriteria, text)
    : buildPrompt(sectionLabel, text);

  const { rawText, provider } = await runChain(prompt, config);
  const verdict = parseVerdict(rawText);
  if (specificCriteria) {
    const band = scoreToBand(verdict.scorePercent);
    return { ...verdict, status: band.status, ratingLabel: band.label, provider };
  }
  return { ...verdict, provider };
}

// ════════════════════════════════════════════════════
// Whole-paper section detection — lets a teacher upload one complete paper
// instead of 13 separate files. Two passes:
//   1. Heading/label matching: scan short standalone lines for known
//      section-heading phrases ("Abstract", "Significance of the Study",
//      etc.) and slice the text between consecutive headings.
//   2. AI fallback: whatever heading-matching couldn't find (unlabeled,
//      renamed, or oddly formatted headings) gets ONE extra AI call asking
//      the model to locate just those remaining sections in the full text.
// ════════════════════════════════════════════════════
const SECTION_ALIASES = {
  abstract: [/^abstract$/i],
  rationale: [/rationale(\s+of\s+the\s+study)?/i, /background\s+of\s+the\s+study/i, /^introduction$/i],
  methodology: [/^methodology$/i, /research\s+methodology/i, /materials\s+and\s+methods/i, /methods\s+and\s+materials/i],
  research_questions: [/research\s+questions?/i, /statement\s+of\s+the\s+problem/i],
  research_objectives: [/objectives\s+of\s+the\s+study/i, /research\s+objectives/i, /^objectives$/i],
  hypotheses: [/hypothes[ei]s/i],
  theoretical_framework: [/theoretical\s+framework/i],
  conceptual_framework: [/conceptual\s+framework/i],
  scope_limitations: [/scope\s+and\s+limitations?/i, /scope\s+and\s+delimitations?/i],
  significance: [/significance\s+of\s+the\s+study/i],
  definition_of_terms: [/definition\s+of\s+terms/i],
  statistical_analysis: [/statistical\s+(treatment|analysis)(\s+of\s+data)?/i, /^data\s+analysis$/i],
  bibliography: [/^bibliography$/i, /^references$/i, /reference\s+list/i, /works\s+cited/i]
};

// Strips common heading decoration (numbering, roman numerals, markdown
// markers, chapter/part labels) so "II. Significance of the Study" or
// "**Significance of the Study**" both reduce to plain heading text.
function stripHeadingMarkers(line) {
  return line
    .replace(/^[\s#*_>\-•]+/, "")
    .replace(/^(chapter|part|section)\s+\w+[:.]?\s*/i, "")
    .replace(/^[ivxlcdm]+\.\s*/i, "")
    .replace(/^\d+(\.\d+)*[.):]?\s*/, "")
    .replace(/[\s*_#:.\-]+$/, "")
    .trim();
}

function heuristicSplit(fullText) {
  const lines = fullText.split(/\r?\n/);
  const hits = [];
  let offset = 0;
  for (const raw of lines) {
    const clean = stripHeadingMarkers(raw);
    // Heading lines are short standalone lines — long lines are body text
    // even if they happen to contain a matching phrase somewhere in them.
    if (clean.length > 0 && clean.length <= 60) {
      for (const [sectionId, patterns] of Object.entries(SECTION_ALIASES)) {
        if (patterns.some(re => re.test(clean))) {
          hits.push({ sectionId, lineStart: offset });
          break;
        }
      }
    }
    offset += raw.length + 1; // +1 accounts for the \n split() consumed
  }

  // Only the first heading match per section counts — later mentions of
  // e.g. "the Abstract above" are body text, not a second heading.
  const firstBySection = {};
  for (const hit of hits) {
    if (!(hit.sectionId in firstBySection)) firstBySection[hit.sectionId] = hit;
  }
  const ordered = Object.values(firstBySection).sort((a, b) => a.lineStart - b.lineStart);

  const found = {};
  for (let i = 0; i < ordered.length; i++) {
    const start = ordered[i].lineStart;
    const end = i + 1 < ordered.length ? ordered[i + 1].lineStart : fullText.length;
    const headingLineEnd = fullText.indexOf("\n", start);
    const bodyStart = headingLineEnd === -1 ? start : headingLineEnd + 1;
    const body = fullText.slice(bodyStart, end).trim();
    if (body.length >= 20) found[ordered[i].sectionId] = body;
  }
  return found;
}

function buildSegmentationPrompt(missingSections, fullText) {
  const list = missingSections.map(s => `- "${s.id}": ${s.label}`).join("\n");
  const jsonShape = missingSections.map(s => `"${s.id}":"text or null"`).join(",");
  return `
You are helping split a Philippine Junior High School (Grade 8-10) research
paper into its labeled sections. The section(s) below could not be located
by heading-text matching alone. Find each one within the full paper text and
return ONLY that section's own content — not neighboring sections, not the
heading itself, not the whole paper.

Sections to find (JSON key: section this key means):
${list}

Rules:
- If a section is genuinely not present in the paper, use null for it.
- Do not invent, summarize, or paraphrase — copy the relevant text verbatim
  from the paper.
- Respond ONLY in this exact JSON shape, no markdown fences, no preamble:
{${jsonShape}}

FULL PAPER TEXT:
"""
${fullText.slice(0, 18000)}
"""
`.trim();
}

function parseSegmentation(raw, expectedIds) {
  const cleaned = raw.trim().replace(/^```json\s*|^```\s*|```$/g, "").trim();
  const parsed = JSON.parse(cleaned);
  const out = {};
  for (const id of expectedIds) {
    const v = parsed[id];
    if (typeof v === "string" && v.trim().length >= 20) out[id] = v.trim();
  }
  return out;
}

/**
 * Detects which of the 13 known sections are present in a whole uploaded
 * paper. Returns:
 *   sections:   { sectionId: extractedText, ... } — only sections found
 *   matchedVia: { sectionId: "heading" | "ai" }    — how each was found
 *   provider:   the AI provider used for the fallback pass, if any
 * Sections not present in `sections` simply weren't found by either pass —
 * the caller (server.js) leaves those for manual upload as before.
 */
export async function detectSections(fullText, config) {
  const heuristicFound = heuristicSplit(fullText);
  const matchedVia = {};
  Object.keys(heuristicFound).forEach(id => { matchedVia[id] = "heading"; });

  const missing = SECTIONS.filter(s => !heuristicFound[s.id]);
  let aiFound = {};
  let provider = null;

  if (missing.length && fullText.trim().length > 200) {
    try {
      const prompt = buildSegmentationPrompt(missing, fullText);
      const { rawText, provider: usedProvider } = await runChain(prompt, config);
      aiFound = parseSegmentation(rawText, missing.map(s => s.id));
      provider = usedProvider;
      Object.keys(aiFound).forEach(id => { matchedVia[id] = "ai"; });
    } catch (e) {
      // Best-effort fallback — if it fails, still return whatever heading
      // matching found rather than failing the whole upload.
      console.error("[detectSections] AI segmentation fallback failed:", e.message);
    }
  }

  return { sections: { ...heuristicFound, ...aiFound }, matchedVia, provider };
}
