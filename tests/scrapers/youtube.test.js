const fs = require('fs');
const path = require('path');
const { scrapeYoutubeComments } = require('../../content-scripts/youtube');

function loadFixture(name) {
  return fs.readFileSync(path.join(__dirname, '../fixtures', name), 'utf8');
}

beforeEach(() => {
  document.documentElement.innerHTML = loadFixture('youtube-comments.html');
});

test('scrapeYoutubeComments returns all visible comment texts', () => {
  const result = scrapeYoutubeComments(document);

  expect(result.comments.length).toBeGreaterThanOrEqual(1);
});

test('scrapeYoutubeComments captures question text from comments', () => {
  const result = scrapeYoutubeComments(document);
  const allText = result.comments.join(' ');

  expect(allText).toContain('MindBody');
  expect(allText).toContain('contract length');
});

test('scrapeYoutubeComments returns empty array when no comments loaded yet', () => {
  document.documentElement.innerHTML = '<html><body><div id="comments"></div></body></html>';

  const result = scrapeYoutubeComments(document);

  expect(result.comments).toEqual([]);
});
