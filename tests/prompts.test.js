const { assemblePrompt, assembleMasterPrompt, formatIcp, assembleSuggestionsPrompt, parseSuggestions, parseBuildTheseFirst, assembleBlogPrompt, parseBlogPost } = require('../src/prompts');

const icp = {
  product: 'Rolliance',
  description: 'Martial arts studio management SaaS',
  price: '$169/month',
  competitors: ['MindBody', 'ZenPlanner', 'Gymdesk'],
};

const content = 'Some raw scraped content from the page';

test('assembled prompt contains the ICP product name', () => {
  const prompt = assemblePrompt('reddit', content, icp);

  expect(prompt).toContain('Rolliance');
});

test('assembled prompt contains the raw content', () => {
  const prompt = assemblePrompt('reddit', content, icp);

  expect(prompt).toContain(content);
});

test('different sources produce different prompts for the same content', () => {
  const redditPrompt = assemblePrompt('reddit', content, icp);
  const g2Prompt = assemblePrompt('g2', content, icp);

  expect(redditPrompt).not.toEqual(g2Prompt);
});

test('assemblePrompt returns null for an unsupported source', () => {
  const result = assemblePrompt('twitter', content, icp);

  expect(result).toBeNull();
});

test('master prompt contains all provided questions', () => {
  const questions = ['Question A?', 'Question B?', 'Question C?'];
  const prompt = assembleMasterPrompt(questions, icp);

  questions.forEach(q => {
    expect(prompt).toContain(q);
  });
});

test('master prompt contains ICP product name', () => {
  const prompt = assembleMasterPrompt(['Any question?'], icp);

  expect(prompt).toContain('Rolliance');
});

test('master prompt contains competitor names', () => {
  const prompt = assembleMasterPrompt(['Any question?'], icp);

  expect(prompt).toContain('MindBody');
});

// ── assembleSuggestionsPrompt ────────────────────────────────────────────────

test('suggestions prompt contains ICP product name', () => {
  const prompt = assembleSuggestionsPrompt(['How do I manage waitlists?'], icp, '');
  expect(prompt).toContain('Rolliance');
});

test('suggestions prompt contains competitor names', () => {
  const prompt = assembleSuggestionsPrompt(['How do I manage waitlists?'], icp, '');
  expect(prompt).toContain('MindBody');
});

test('suggestions prompt contains questions from the bank', () => {
  const questions = ['How do I manage waitlists?', 'Is there a free trial?'];
  const prompt = assembleSuggestionsPrompt(questions, icp, '');
  questions.forEach(q => expect(prompt).toContain(q));
});

test('suggestions prompt includes gap context when last synthesis is provided', () => {
  const synthesis = 'GAPS: The UNAWARE stage has the fewest questions.';
  const prompt = assembleSuggestionsPrompt(['A question?'], icp, synthesis);
  expect(prompt).toContain('UNAWARE');
});

test('suggestions prompt works without a last synthesis', () => {
  const prompt = assembleSuggestionsPrompt(['A question?'], icp, '');
  expect(typeof prompt).toBe('string');
  expect(prompt.length).toBeGreaterThan(0);
});

// ── parseSuggestions ─────────────────────────────────────────────────────────

test('parseSuggestions extracts reddit searches', () => {
  const text = `REDDIT:\n1. r/bjj MindBody alternatives\n2. r/martialarts studio software\n\nGOOGLE:\n1. martial arts software comparison`;
  const result = parseSuggestions(text);
  expect(result.reddit).toHaveLength(2);
  expect(result.reddit[0]).toContain('MindBody');
});

test('parseSuggestions extracts google searches', () => {
  const text = `REDDIT:\n1. r/bjj question\n\nGOOGLE:\n1. martial arts software comparison\n2. MindBody vs ZenPlanner`;
  const result = parseSuggestions(text);
  expect(result.google).toHaveLength(2);
  expect(result.google[1]).toContain('ZenPlanner');
});

test('parseSuggestions returns empty arrays when sections are missing', () => {
  const result = parseSuggestions('No sections here at all.');
  expect(result.reddit).toEqual([]);
  expect(result.google).toEqual([]);
});

test('parseSuggestions handles period-terminated numbering (1. vs 1))', () => {
  const text = `REDDIT:\n1. r/bjj query one\n2. r/martialarts query two\nGOOGLE:\n1. google query one`;
  const result = parseSuggestions(text);
  expect(result.reddit).toHaveLength(2);
  expect(result.google).toHaveLength(1);
});

// ── parseBuildTheseFirst ─────────────────────────────────────────────────────

const BUILD_THESE_FIRST_MARKDOWN = `
## Build These First

1. **How do I manage class schedules without double-booking?** This targets the Problem Aware stage where studio owners feel scheduling pain but haven't named the cause.
2. **What does $169/month include compared to MindBody?** Critical decision-stage content.
3. **Is there a free trial for Rolliance?** High transactional intent.

## Next Section Heading

Some other content.
`;

test('parseBuildTheseFirst extracts all questions from the section', () => {
  const result = parseBuildTheseFirst(BUILD_THESE_FIRST_MARKDOWN);

  expect(result).toHaveLength(3);
});

test('parseBuildTheseFirst strips bold markers from questions', () => {
  const result = parseBuildTheseFirst(BUILD_THESE_FIRST_MARKDOWN);

  result.forEach(q => {
    expect(q).not.toContain('**');
  });
});

test('parseBuildTheseFirst strips rationale text after the question', () => {
  const result = parseBuildTheseFirst(BUILD_THESE_FIRST_MARKDOWN);

  expect(result[0]).toBe('How do I manage class schedules without double-booking?');
});

test('parseBuildTheseFirst returns empty array when section is absent', () => {
  const result = parseBuildTheseFirst('## Some Other Section\n\nNo top 10 here.');

  expect(result).toEqual([]);
});

test('parseBuildTheseFirst stops collecting at the next heading', () => {
  const result = parseBuildTheseFirst(BUILD_THESE_FIRST_MARKDOWN);

  expect(result).not.toContain('Some other content.');
  expect(result).toHaveLength(3);
});

test('parseBuildTheseFirst works with ### heading variant', () => {
  const md = `### Build These First\n1. **Does Rolliance integrate with Stripe?** Rationale here.\n2. **Can I track belt progressions?** Another rationale.`;
  const result = parseBuildTheseFirst(md);

  expect(result).toHaveLength(2);
  expect(result[0]).toBe('Does Rolliance integrate with Stripe?');
});

test('parseBuildTheseFirst works with STEP 6 heading (actual AI output format)', () => {
  const md = `### STEP 6 — TOP 10 LIST\n\n1. How do I effectively manage my martial arts studio?  \n   *Rationale: Central concern for all prospects.*\n\n2. Is there a trial period to test Rolliance?  \n   *Rationale: High transactional intent.*\n\n### STEP 7 — GAPS\n\nSome gap text.`;
  const result = parseBuildTheseFirst(md);

  expect(result).toHaveLength(2);
  expect(result[0]).toBe('How do I effectively manage my martial arts studio?');
  expect(result[1]).toBe('Is there a trial period to test Rolliance?');
});

test('parseBuildTheseFirst falls back to last numbered list when heading is unrecognised', () => {
  const md = `## Journey Stages\n\n| 1 | Some question | Info |\n| 2 | Another | Info |\n\n## Whatever Heading The AI Chose\n\n1. How do I manage my studio?\n   Rationale: important.\n2. Is there a free trial?\n   Rationale: transactional.\n3. What does pricing include?\n   Rationale: cost concern.\n4. How does billing work?\n   Rationale: key concern.\n5. Can I track belt progressions?\n   Rationale: niche need.\n\n## Gaps\n\nUnaware stage is thin.`;
  const result = parseBuildTheseFirst(md);

  expect(result.length).toBeGreaterThanOrEqual(5);
  expect(result[0]).toBe('How do I manage my studio?');
});

// ── assembleBlogPrompt ───────────────────────────────────────────────────────

test('assembleBlogPrompt contains the question text', () => {
  const question = 'How do I manage class schedules without double-booking?';
  const prompt = assembleBlogPrompt(question, icp);

  expect(prompt).toContain(question);
});

test('assembleBlogPrompt contains the ICP product name', () => {
  const prompt = assembleBlogPrompt('Any question?', icp);

  expect(prompt).toContain('Rolliance');
});

test('assembleBlogPrompt contains the price', () => {
  const prompt = assembleBlogPrompt('Any question?', icp);

  expect(prompt).toContain('$169/month');
});

test('assembleBlogPrompt contains competitor names', () => {
  const prompt = assembleBlogPrompt('Any question?', icp);

  expect(prompt).toContain('MindBody');
});

test('assembleBlogPrompt requests SEO title and meta description', () => {
  const prompt = assembleBlogPrompt('Any question?', icp);

  expect(prompt.toLowerCase()).toContain('seo title');
  expect(prompt.toLowerCase()).toContain('meta description');
});

test('assembleBlogPrompt works when icp fields are partially empty', () => {
  const sparseIcp = { product: 'Rolliance', description: '', price: '', competitors: [] };
  const prompt = assembleBlogPrompt('Any question?', sparseIcp);

  expect(typeof prompt).toBe('string');
  expect(prompt).toContain('Rolliance');
});

test('formatIcp produces a non-empty string with all ICP fields', () => {
  const formatted = formatIcp(icp);

  expect(formatted).toContain('Rolliance');
  expect(formatted).toContain('$169/month');
  expect(formatted).toContain('MindBody');
  expect(typeof formatted).toBe('string');
  expect(formatted.length).toBeGreaterThan(0);
});

// ── Template overrides (editable prompts) ────────────────────────────────────

test('assembleMasterPrompt uses a custom template override when provided', () => {
  const out = assembleMasterPrompt(['Q1?'], icp, 'CUSTOM ICP={{ICP}} Q={{QUESTIONS}}');
  expect(out).toContain('CUSTOM');
  expect(out).toContain('Q1?');
  expect(out).toContain('Rolliance');
  expect(out).not.toContain('Buyer-Question Map'); // default master template not used
});

test('assemblePrompt uses a custom override template for the source', () => {
  const out = assemblePrompt('reddit', 'CONTENT_X', icp, 'OVERRIDE {{CONTENT}}');
  expect(out).toBe('OVERRIDE CONTENT_X');
});

test('assembleBlogPrompt uses a custom override template', () => {
  const out = assembleBlogPrompt('Why switch?', icp, 'BLOG Q={{QUESTION}} ICP={{ICP}}');
  expect(out).toContain('BLOG Q=Why switch?');
  expect(out).toContain('Rolliance');
});

test('assembleSuggestionsPrompt uses a custom override template', () => {
  const out = assembleSuggestionsPrompt(['Q1?'], icp, '', 'SUGG ICP={{ICP}} Q={{QUESTIONS}}');
  expect(out).toContain('SUGG');
  expect(out).toContain('Q1?');
  expect(out).toContain('Rolliance');
});

test('an empty override falls back to the default template', () => {
  const out = assembleMasterPrompt(['Q1?'], icp, '');
  expect(out).toContain('Buyer-Question Map');
});

test('question text containing a dollar sign is preserved verbatim', () => {
  const out = assembleMasterPrompt(['Is it really $99/month?'], icp);
  expect(out).toContain('$99/month');
});

// ── Blog guidelines + structured output ──────────────────────────────────────

test('assembleBlogPrompt injects custom guidelines', () => {
  const out = assembleBlogPrompt('Why switch?', icp, undefined, 'RULE: never use the word synergy.');
  expect(out).toContain('RULE: never use the word synergy.');
});

test('assembleBlogPrompt uses default guidelines (which forbid em dashes) when none given', () => {
  const out = assembleBlogPrompt('Why switch?', icp);
  expect(out.toLowerCase()).toContain('dash');
});

const SAMPLE_BLOG_OUTPUT = `TITLE: How to Choose Studio Software
EXCERPT: A short guide for studio owners weighing their options.
META_DESCRIPTION: Compare studio management tools and pick the right one for your gym.
CONTENT_HTML:
<h2>Getting started</h2>
<p>Running a studio is hard.</p>
<ul><li>Track attendance</li></ul>`;

test('parseBlogPost extracts plain-text title, excerpt, and meta description', () => {
  const post = parseBlogPost(SAMPLE_BLOG_OUTPUT);
  expect(post.title).toBe('How to Choose Studio Software');
  expect(post.excerpt).toBe('A short guide for studio owners weighing their options.');
  expect(post.metaDescription).toBe('Compare studio management tools and pick the right one for your gym.');
});

test('parseBlogPost returns the body as HTML, preserving tags across multiple lines', () => {
  const post = parseBlogPost(SAMPLE_BLOG_OUTPUT);
  expect(post.contentHtml).toContain('<h2>Getting started</h2>');
  expect(post.contentHtml).toContain('<p>Running a studio is hard.</p>');
  expect(post.contentHtml).toContain('<li>Track attendance</li>');
  expect(post.contentHtml).not.toContain('TITLE:');
  expect(post.contentHtml).not.toContain('META_DESCRIPTION:');
});

test('parseBlogPost falls back to treating unlabeled output as the HTML body so content is never lost', () => {
  const post = parseBlogPost('<p>Model ignored the format.</p>');
  expect(post.title).toBe('');
  expect(post.contentHtml).toBe('<p>Model ignored the format.</p>');
});
