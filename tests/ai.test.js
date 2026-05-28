const { extractQuestions, synthesize } = require('../src/ai');

const claudeSettings = { provider: 'claude', apiKey: 'test-claude-key' };
const openaiSettings = { provider: 'openai', openaiApiKey: 'test-openai-key' };

function mockFetchSuccess(text, isOpenAI = false) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => isOpenAI
      ? { choices: [{ message: { content: text } }] }
      : { content: [{ type: 'text', text }] },
  });
}

function mockFetchError(status) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({}),
  });
}

afterEach(() => jest.restoreAllMocks());

// ── Claude provider ──────────────────────────────────────────────────────────

test('extractQuestions with Claude calls Anthropic endpoint', async () => {
  mockFetchSuccess('1. Question A?\n2. Question B?');
  await extractQuestions('prompt', claudeSettings);
  expect(global.fetch.mock.calls[0][0]).toContain('anthropic.com');
});

test('extractQuestions with Claude sends x-api-key header', async () => {
  mockFetchSuccess('1. Question A?');
  await extractQuestions('prompt', claudeSettings);
  expect(global.fetch.mock.calls[0][1].headers['x-api-key']).toBe('test-claude-key');
});

test('extractQuestions with Claude parses numbered list', async () => {
  mockFetchSuccess('1. How do I manage waitlists?\n2. Can I automate billing?');
  const questions = await extractQuestions('prompt', claudeSettings);
  expect(questions).toContain('How do I manage waitlists?');
  expect(questions).toContain('Can I automate billing?');
});

test('extractQuestions with Claude throws descriptive error on 401', async () => {
  mockFetchError(401);
  await expect(extractQuestions('prompt', claudeSettings)).rejects.toThrow('Invalid API key');
});

// ── OpenAI provider ──────────────────────────────────────────────────────────

test('extractQuestions with OpenAI calls OpenAI endpoint', async () => {
  mockFetchSuccess('1. Question A?\n2. Question B?', true);
  await extractQuestions('prompt', openaiSettings);
  expect(global.fetch.mock.calls[0][0]).toContain('openai.com');
});

test('extractQuestions with OpenAI sends Authorization Bearer header', async () => {
  mockFetchSuccess('1. Question A?', true);
  await extractQuestions('prompt', openaiSettings);
  expect(global.fetch.mock.calls[0][1].headers['Authorization']).toBe('Bearer test-openai-key');
});

test('extractQuestions with OpenAI parses response from choices[0].message.content', async () => {
  mockFetchSuccess('1. How do I migrate from MindBody?\n2. Is there a free trial?', true);
  const questions = await extractQuestions('prompt', openaiSettings);
  expect(questions).toContain('How do I migrate from MindBody?');
  expect(questions).toContain('Is there a free trial?');
});

test('extractQuestions with OpenAI throws descriptive error on 401', async () => {
  mockFetchError(401);
  await expect(extractQuestions('prompt', openaiSettings)).rejects.toThrow('Invalid API key');
});

test('extractQuestions with OpenAI throws descriptive error on 429', async () => {
  mockFetchError(429);
  await expect(extractQuestions('prompt', openaiSettings)).rejects.toThrow('Rate limited');
});

// ── Synthesize ────────────────────────────────────────────────────────────────

test('synthesize with Claude returns raw markdown string', async () => {
  const markdown = '## Unaware\n| # | Question |\n';
  mockFetchSuccess(markdown);
  const result = await synthesize('prompt', claudeSettings);
  expect(result).toBe(markdown);
});

test('synthesize with OpenAI returns raw markdown string', async () => {
  const markdown = '## Unaware\n| # | Question |\n';
  mockFetchSuccess(markdown, true);
  const result = await synthesize('prompt', openaiSettings);
  expect(result).toBe(markdown);
});

test('synthesize with OpenAI calls OpenAI endpoint', async () => {
  mockFetchSuccess('# Map', true);
  await synthesize('prompt', openaiSettings);
  expect(global.fetch.mock.calls[0][0]).toContain('openai.com');
});
