const fs = require('fs');
const path = require('path');
const { scrapeG2Reviews } = require('../../content-scripts/g2');

function loadFixture(name) {
  return fs.readFileSync(path.join(__dirname, '../fixtures', name), 'utf8');
}

beforeEach(() => {
  document.documentElement.innerHTML = loadFixture('g2-reviews.html');
});

test('scrapeG2Reviews returns review text from all visible reviews', () => {
  const result = scrapeG2Reviews(document);

  expect(result.reviews.length).toBeGreaterThanOrEqual(2);
});

test('scrapeG2Reviews captures the dislike/cons sections', () => {
  const result = scrapeG2Reviews(document);
  const allText = result.reviews.join(' ');

  expect(allText).toContain('Customer support takes too long');
});

test('scrapeG2Reviews returns empty array on empty page', () => {
  document.documentElement.innerHTML = '<html><body></body></html>';

  const result = scrapeG2Reviews(document);

  expect(result.reviews).toEqual([]);
});
