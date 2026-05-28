const { assemblePrompt, assembleMasterPrompt, formatIcp } = require('../src/prompts');

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

test('formatIcp produces a non-empty string with all ICP fields', () => {
  const formatted = formatIcp(icp);

  expect(formatted).toContain('Rolliance');
  expect(formatted).toContain('$169/month');
  expect(formatted).toContain('MindBody');
  expect(typeof formatted).toBe('string');
  expect(formatted.length).toBeGreaterThan(0);
});
