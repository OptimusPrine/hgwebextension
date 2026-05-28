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

function formatIcp(icp) {
  const competitors = Array.isArray(icp.competitors) ? icp.competitors.join(', ') : (icp.competitors || '');
  return `Product: ${icp.product || ''}
Description: ${icp.description || ''}
Price: ${icp.price || ''}
Key competitors: ${competitors}`;
}

function assemblePrompt(source, content, icp) {
  const template = SOURCE_PROMPTS[source];
  if (!template) return null;
  return template
    .replace('{{ICP}}', formatIcp(icp))
    .replace('{{CONTENT}}', content);
}

function assembleMasterPrompt(questions, icp) {
  const questionList = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
  return MASTER_PROMPT
    .replace('{{ICP}}', formatIcp(icp))
    .replace('{{QUESTIONS}}', questionList);
}

function assembleSuggestionsPrompt(questions, icp, lastSynthesisSnippet) {
  const icpText = formatIcp(icp);
  const sample = questions.slice(-25).map((q, i) => `${i + 1}. ${q}`).join('\n');
  const gapContext = lastSynthesisSnippet
    ? `\nContext from the last synthesis (pay attention to the GAPS section):\n"""\n${lastSynthesisSnippet}\n"""\n`
    : '';

  return `You are a marketing research strategist helping build a Buyer-Question Map.

ICP:
${icpText}
${gapContext}
Current questions already captured (most recent ${questions.length <= 25 ? questions.length : 25} shown):
${sample}

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

if (typeof module !== 'undefined') {
  module.exports = { assemblePrompt, assembleMasterPrompt, formatIcp, assembleSuggestionsPrompt, parseSuggestions };
}
