const MASTER_PROMPT = `You are a senior B2B content strategist and demand-gen lead.
I have collected raw buyer questions from 25 different sources (Reddit, sales calls, support tickets,
reviews, YouTube, Google PAA, AI assistants, communities, surveys, etc.).

Your job is to turn this raw list into my Buyer-Question Map.

STEP 1 — DEDUPE
Merge near-duplicate questions. Preserve the most natural, buyer-voiced phrasing of each.

STEP 2 — FILTER
Remove questions that are off-topic, internal, or only relevant to existing customers (unless they
also imply a pre-purchase concern).

STEP 3 — SORT BY JOURNEY STAGE
Sort the remaining questions into these five stages, in this order:

1. UNAWARE — They feel friction but haven't named the problem yet.
   (e.g., "Why is my team always behind on reporting?")

2. PROBLEM AWARE — They've named the problem but don't know what category of solution to look for.
   (e.g., "How do other teams handle multi-source reporting at scale?")

3. SOLUTION AWARE — They know solutions exist; they're learning the category.
   (e.g., "What is a reverse ETL tool and do I need one?")

4. PRODUCT AWARE — They're comparing specific vendors.
   (e.g., "{{Vendor A}} vs {{Vendor B}} for mid-market teams")

5. MOST AWARE / DECISION — They're ready to buy but need the final reassurance.
   (e.g., "What does a typical contract with {{Vendor A}} look like?")

STEP 4 — TARGET COUNT
Aim for 40–60 final questions total. If I gave you fewer, infer reasonable additions.
If I gave you more, keep only the highest-leverage ones (highest buying intent, broadest applicability).

STEP 5 — FORMAT
Output as a markdown table per stage with these columns:

| # | Question | Search intent (Informational / Comparative / Transactional) | Recommended content format (Pillar article / Cluster article / Comparison page / Calculator / Video / Case study) | Priority (High / Medium / Low based on buying intent and search volume signal) |

STEP 6 — TOP 10 LIST
After the five tables, give me a "Build These First" list of the 10 highest-leverage questions across
all stages — the ones I should turn into content this quarter. For each, write a one-sentence rationale.

STEP 7 — GAPS
Tell me which journey stage has the fewest questions. That's where I need to mine more.

ICP CONTEXT:
{{ICP}}

RAW QUESTIONS:
"""
{{QUESTIONS}}
"""

Output the deliverable now.`;

const SOURCE_PROMPTS = {
  reddit: `You are a buyer-language analyst. Below is raw content from a Reddit thread.

Your goal: extract all questions, concerns, frustrations, and decision criteria that a buyer in this market might have before purchasing a solution.

Look for:
- Direct questions ("How do I...", "Is there a way to...", "Does anyone know...")
- Complaints and frustrations — reframe as implicit buyer questions ("Users complain about X" → "How do I avoid X?")
- Comparisons to competing tools
- Feature requests that reveal unmet needs
- Price/contract concerns

Return ONLY a numbered list of questions in the buyer's voice. No commentary. No headers. No explanations.

ICP CONTEXT:
{{ICP}}

RAW CONTENT:
"""
{{CONTENT}}
"""`,

  google: `You are a buyer-language analyst. Below are "People Also Ask" questions and search suggestions from Google.

Your goal: extract and lightly reformat these into clear buyer questions relevant to this product category.

Return ONLY a numbered list of questions in the buyer's voice. No commentary. No headers.

ICP CONTEXT:
{{ICP}}

RAW CONTENT:
"""
{{CONTENT}}
"""`,

  g2: `You are a buyer-language analyst. Below are customer reviews from the G2 software review platform.

Your goal: extract all questions, concerns, frustrations, decision criteria, and switching triggers that a prospective buyer might have.

Look for:
- "Cons" or "What do you dislike" sections — reframe as buyer questions
- Onboarding and support concerns
- Price/contract complaints
- Feature gaps or limitations mentioned
- Comparisons to competitor products
- Reasons users considered switching

Return ONLY a numbered list of questions in the buyer's voice. No commentary. No headers.

ICP CONTEXT:
{{ICP}}

RAW CONTENT:
"""
{{CONTENT}}
"""`,

  capterra: `You are a buyer-language analyst. Below are customer reviews from Capterra.

Your goal: extract all questions, concerns, frustrations, decision criteria, and switching triggers that a prospective buyer might have.

Look for:
- Negative sections and cons — reframe as buyer questions
- Price/contract concerns
- Feature gaps
- Support and onboarding experiences
- Comparisons to other tools

Return ONLY a numbered list of questions in the buyer's voice. No commentary. No headers.

ICP CONTEXT:
{{ICP}}

RAW CONTENT:
"""
{{CONTENT}}
"""`,

  youtube: `You are a buyer-language analyst. Below are comments from a YouTube video about software tools in this market.

Your goal: extract all questions, concerns, and decision criteria that a buyer might have.

Look for:
- Direct questions posted by commenters
- Skepticism or pushback about features or pricing
- Comparisons to other tools mentioned
- Requests for clarification or more information

Return ONLY a numbered list of questions in the buyer's voice. No commentary. No headers.

ICP CONTEXT:
{{ICP}}

RAW CONTENT:
"""
{{CONTENT}}
"""`,
};

const SUGGESTIONS_PROMPT = `You are a marketing research strategist helping build a Buyer-Question Map.

ICP:
{{ICP}}
{{GAP_CONTEXT}}
Current questions already captured (most recent {{COUNT}} shown):
{{QUESTIONS}}

Based on the above, suggest the most valuable search queries to run NEXT — prioritising journey stages that appear underrepresented.

Return exactly this format (no extra commentary):

REDDIT:
1. [specific search query — include subreddit if relevant]
2. [specific search query]
3. [specific search query]
4. [specific search query]
5. [specific search query]

GOOGLE:
1. [specific search query]
2. [specific search query]
3. [specific search query]
4. [specific search query]
5. [specific search query]

Be specific. Use real competitor names. Use the language buyers actually use.`;

// Replaces each {{KEY}} once with its value. Uses a function replacement so that
// `$` sequences in the value (e.g. "$99/month") are inserted verbatim rather than
// interpreted as replacement patterns.
function fill(template, values) {
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.replace(key, () => value);
  }
  return out;
}

function formatIcp(icp) {
  const competitors = Array.isArray(icp.competitors) ? icp.competitors.join(', ') : (icp.competitors || '');
  return `Product: ${icp.product || ''}
Description: ${icp.description || ''}
Price: ${icp.price || ''}
Key competitors: ${competitors}`;
}

function assemblePrompt(source, content, icp, template) {
  const tpl = template || SOURCE_PROMPTS[source];
  if (!tpl) return null;
  return fill(tpl, { '{{ICP}}': formatIcp(icp), '{{CONTENT}}': content });
}

function assembleMasterPrompt(questions, icp, template) {
  const tpl = template || MASTER_PROMPT;
  const questionList = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
  return fill(tpl, { '{{ICP}}': formatIcp(icp), '{{QUESTIONS}}': questionList });
}

function assembleSuggestionsPrompt(questions, icp, lastSynthesisSnippet, template) {
  const tpl = template || SUGGESTIONS_PROMPT;
  const sample = questions.slice(-25).map((q, i) => `${i + 1}. ${q}`).join('\n');
  const count = questions.length <= 25 ? questions.length : 25;
  const gapContext = lastSynthesisSnippet
    ? `\nContext from the last synthesis (pay attention to the GAPS section):\n"""\n${lastSynthesisSnippet}\n"""\n`
    : '';

  return fill(tpl, {
    '{{ICP}}': formatIcp(icp),
    '{{GAP_CONTEXT}}': gapContext,
    '{{COUNT}}': String(count),
    '{{QUESTIONS}}': sample,
  });
}

function parseSuggestions(text) {
  const reddit = [];
  const google = [];
  let current = null;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (/^REDDIT[:\s]/i.test(trimmed)) { current = 'reddit'; continue; }
    if (/^GOOGLE[:\s]/i.test(trimmed)) { current = 'google'; continue; }

    const match = trimmed.match(/^\d+[.)]\s*(.+)/);
    if (!match) continue;
    const query = match[1].trim();
    if (current === 'reddit') reddit.push(query);
    if (current === 'google') google.push(query);
  }

  return { reddit, google };
}

function extractListItem(raw) {
  let text = raw.trim().replace(/\*\*/g, '');
  const q = text.indexOf('?');
  if (q !== -1) return text.slice(0, q + 1).trim();
  const p = text.indexOf('.');
  if (p !== -1) return text.slice(0, p + 1).trim();
  return text.trim();
}

function parseBuildTheseFirst(markdown) {
  const lines = markdown.split('\n');

  // Primary: look for a known section heading then collect the numbered list below it
  const headingRe = /^(#{1,3}\s+|\*\*)(build these first|step 6|top 10)/i;
  let headingFound = false;
  let results = [];
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (headingRe.test(trimmed)) { inSection = true; headingFound = true; continue; }
    if (inSection && /^(#{1,3}\s|\*\*\S)/.test(trimmed)) break;
    if (!inSection) continue;
    const m = trimmed.match(/^\d+[.)]\s+(.+)/);
    if (!m) continue;
    const text = extractListItem(m[1]);
    if (text) results.push(text);
  }

  if (headingFound) return results;

  // Fallback: the top-10 is always the last multi-item numbered list in the doc
  // (journey stage tables use | format, not numbered lists, so this is unambiguous)
  let currentList = [];
  let lastNum = 0;
  let bestList = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (!m) continue;
    const num = parseInt(m[1], 10);
    if (num === 1) { currentList = []; lastNum = 0; }
    if (num !== lastNum + 1) continue;
    lastNum = num;
    const text = extractListItem(m[2]);
    if (text) currentList.push(text);
    if (currentList.length >= 5) bestList = [...currentList];
  }

  return bestList;
}

// House rules for blog generation. Editable in the sidebar (stored separately
// from the structural prompt) and injected into BLOG_PROMPT at {{GUIDELINES}}.
const DEFAULT_BLOG_GUIDELINES = `- Do not use dashes of any kind (em dashes, en dashes, or hyphens in prose). Rewrite any sentence that would need one.
- Tone: confident, practical, peer-to-peer. Write for the buyer described in the ICP context, not a generic audience.
- Use competitor names naturally where relevant for comparison.
- Target 900 to 1200 words in the body.
- Open with a hook that states the problem, then 3 to 4 H2 sections of practical, specific copy with no fluff.
- End with a call to action that mentions the product by name and price.`;

const BLOG_PROMPT = `You are an expert SEO content writer for B2B SaaS.

Write a blog post targeting the following question as the primary keyword topic:

QUESTION: {{QUESTION}}

ICP CONTEXT:
{{ICP}}

GUIDELINES (follow all of these):
{{GUIDELINES}}

Return the post in EXACTLY this structure, with these four labels and nothing before or after. Do not wrap the output in code fences.

TITLE: <a plain-text SEO title, 60 characters or fewer, keyword-first>
EXCERPT: <a plain-text excerpt, 1 to 2 sentences summarising the post>
META_DESCRIPTION: <a plain-text SEO meta description, 155 characters or fewer, including a call to action>
CONTENT_HTML:
<the full blog post body as valid, clean HTML. Use <h2> for section headings, <p> for paragraphs, and <ul>/<ol>/<li> for lists. Do not include the title as an <h1>. Do not include <html>, <head>, or <body> tags; output only the body markup.>`;

function assembleBlogPrompt(question, icp, template, guidelines) {
  const tpl = template || BLOG_PROMPT;
  const guide = guidelines || DEFAULT_BLOG_GUIDELINES;
  return fill(tpl, { '{{QUESTION}}': question, '{{ICP}}': formatIcp(icp), '{{GUIDELINES}}': guide });
}

// Parses the structured blog output into discrete fields. Title/excerpt/meta are
// plain text; the body is HTML. If the model ignored the format, the whole output
// is returned as the HTML body so nothing is silently lost.
function parseBlogPost(text) {
  const field = label => {
    const m = text.match(new RegExp(`^${label}:[ \\t]*(.+)$`, 'mi'));
    return m ? m[1].trim() : '';
  };
  const bodyMatch = text.match(/^CONTENT_HTML:[ \t]*\n?([\s\S]*)$/mi);
  return {
    title: field('TITLE'),
    excerpt: field('EXCERPT'),
    metaDescription: field('META_DESCRIPTION'),
    contentHtml: bodyMatch ? bodyMatch[1].trim() : text.trim(),
  };
}

// Keyed by the id stored in settings.prompts; surfaced in the sidebar for
// viewing/editing and used as the fallback when no override exists.
const DEFAULT_PROMPTS = {
  master: MASTER_PROMPT,
  reddit: SOURCE_PROMPTS.reddit,
  google: SOURCE_PROMPTS.google,
  g2: SOURCE_PROMPTS.g2,
  capterra: SOURCE_PROMPTS.capterra,
  youtube: SOURCE_PROMPTS.youtube,
  suggestions: SUGGESTIONS_PROMPT,
  blog: BLOG_PROMPT,
  'blog-guidelines': DEFAULT_BLOG_GUIDELINES,
};

if (typeof module !== 'undefined') {
  module.exports = { assemblePrompt, assembleMasterPrompt, formatIcp, assembleSuggestionsPrompt, parseSuggestions, parseBuildTheseFirst, assembleBlogPrompt, parseBlogPost, DEFAULT_PROMPTS };
}
