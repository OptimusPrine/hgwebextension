const fs = require('fs');
const path = require('path');
const { scrapeReddit } = require('../../content-scripts/reddit');

function loadFixture(name) {
  return fs.readFileSync(path.join(__dirname, '../fixtures', name), 'utf8');
}

beforeEach(() => {
  document.documentElement.innerHTML = loadFixture('reddit-thread.html');
});

test('scrapeReddit extracts post title from a Reddit thread', () => {
  const result = scrapeReddit(document);

  expect(result.title).toBe('Best software for managing multiple martial arts locations?');
});

test('scrapeReddit extracts post body text', () => {
  const result = scrapeReddit(document);

  expect(result.body).toContain('spreadsheet system is completely breaking down');
});

test('scrapeReddit extracts comments from a Reddit thread', () => {
  const result = scrapeReddit(document);

  expect(result.comments.length).toBeGreaterThanOrEqual(3);
  expect(result.comments.some(c => c.includes('MindBody'))).toBe(true);
});

test('scrapeReddit returns empty strings and array on empty page, does not throw', () => {
  document.documentElement.innerHTML = '<html><body></body></html>';

  const result = scrapeReddit(document);

  expect(result.title).toBe('');
  expect(result.body).toBe('');
  expect(result.comments).toEqual([]);
});
