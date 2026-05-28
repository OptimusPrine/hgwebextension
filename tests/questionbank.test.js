const mockStorage = {};

global.chrome = {
  storage: {
    local: {
      get: (keys, callback) => {
        const k = typeof keys === 'string' ? [keys] : keys;
        const result = {};
        k.forEach(key => { result[key] = mockStorage[key]; });
        if (callback) callback(result);
        return Promise.resolve(result);
      },
      set: (items, callback) => {
        Object.assign(mockStorage, items);
        if (callback) callback();
        return Promise.resolve();
      },
    },
  },
};

const { addQuestions, getAllQuestions, getQuestionsBySource, clearBank } = require('../src/questionbank');

beforeEach(() => {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
});

test('questions added from one source can be retrieved', async () => {
  await addQuestions(['How do I manage waitlists?', 'Can I automate billing?'], 'reddit');
  const questions = await getAllQuestions();

  expect(questions).toHaveLength(2);
  expect(questions.map(q => q.text)).toContain('How do I manage waitlists?');
  expect(questions.map(q => q.text)).toContain('Can I automate billing?');
});

test('questions from multiple sources all accumulate in the bank', async () => {
  await addQuestions(['Q from reddit'], 'reddit');
  await addQuestions(['Q from g2'], 'g2');
  const questions = await getAllQuestions();

  expect(questions).toHaveLength(2);
  expect(questions.map(q => q.source)).toContain('reddit');
  expect(questions.map(q => q.source)).toContain('g2');
});

test('clearing the bank results in an empty question list', async () => {
  await addQuestions(['Some question'], 'reddit');
  await clearBank();
  const questions = await getAllQuestions();

  expect(questions).toHaveLength(0);
});

test('getQuestionsBySource returns only questions from that source', async () => {
  await addQuestions(['Reddit Q1', 'Reddit Q2'], 'reddit');
  await addQuestions(['G2 Q1'], 'g2');

  const redditOnly = await getQuestionsBySource('reddit');

  expect(redditOnly).toHaveLength(2);
  expect(redditOnly.every(q => q.source === 'reddit')).toBe(true);
});

test('each stored question has a timestamp', async () => {
  const before = Date.now();
  await addQuestions(['Time-stamped question'], 'google');
  const after = Date.now();

  const [question] = await getAllQuestions();

  expect(question.timestamp).toBeGreaterThanOrEqual(before);
  expect(question.timestamp).toBeLessThanOrEqual(after);
});

test('adding to an existing bank appends rather than replaces', async () => {
  await addQuestions(['First'], 'reddit');
  await addQuestions(['Second'], 'reddit');
  const questions = await getAllQuestions();

  expect(questions).toHaveLength(2);
});
