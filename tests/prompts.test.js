const { assemblePrompt, assembleMasterPrompt, formatIcp, assembleSuggestionsPrompt, parseSuggestions } = require('../src/prompts');

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

test('formatIcp produces a non-empty string with all ICP fields', () => {
  const formatted = formatIcp(icp);

  expect(formatted).toContain('Rolliance');
  expect(formatted).toContain('$169/month');
  expect(formatted).toContain('MindBody');
  expect(typeof formatted).toBe('string');
  expect(formatted.length).toBeGreaterThan(0);
});
