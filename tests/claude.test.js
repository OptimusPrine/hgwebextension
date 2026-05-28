const { extractQuestions, synthesize } = require('../src/claude');

const API_KEY = 'test-api-key';

function mockFetchSuccess(text) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ type: 'text', text }],
    }),
  });
}

function mockFetchError(status = 500) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error: { message: 'Server error' } }),
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

test('extractQuestions parses a numbered list from Claude response', async () => {
  mockFetchSuccess('1. How do I manage waitlists?\n2. Can I automate billing?\n3. Is there a mobile app?');

  const questions = await extractQuestions('some prompt', API_KEY);

  expect(questions).toHaveLength(3);
  expect(questions).toContain('How do I manage waitlists?');
  expect(questions).toContain('Can I automate billing?');
  expect(questions).toContain('Is there a mobile app?');
});

test('extractQuestions throws with a descriptive message on 401', async () => {
  mockFetchError(401);

  await expect(extractQuestions('some prompt', API_KEY)).rejects.toThrow('Invalid API key');
});

test('extractQuestions throws with a descriptive message on 429', async () => {
  mockFetchError(429);

  await expect(extractQuestions('some prompt', API_KEY)).rejects.toThrow('Rate limited');
});

test('extractQuestions throws on generic server error', async () => {
  mockFetchError(500);

  await expect(extractQuestions('some prompt', API_KEY)).rejects.toThrow('500');
});

test('extractQuestions sends the API key in the x-api-key header', async () => {
  mockFetchSuccess('1. A question?');

  await extractQuestions('some prompt', API_KEY);

  const callArgs = global.fetch.mock.calls[0];
  const headers = callArgs[1].headers;

  expect(headers['x-api-key']).toBe(API_KEY);
});

test('synthesize returns raw markdown string from Claude response', async () => {
  const markdown = '## Stage 1: Unaware\n| # | Question | ...\n';
  mockFetchSuccess(markdown);

  const result = await synthesize('some master prompt', API_KEY);

  expect(result).toBe(markdown);
});

test('synthesize throws on API error', async () => {
  mockFetchError(429);

  await expect(synthesize('some master prompt', API_KEY)).rejects.toThrow('Rate limited');
});

test('synthesize sends the API key in the x-api-key header', async () => {
  mockFetchSuccess('# Map\n');

  await synthesize('some prompt', API_KEY);

  const headers = global.fetch.mock.calls[0][1].headers;
  expect(headers['x-api-key']).toBe(API_KEY);
});
