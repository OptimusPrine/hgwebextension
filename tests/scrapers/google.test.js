const fs = require('fs');
const path = require('path');
const { scrapeGooglePAA } = require('../../content-scripts/google');

function loadFixture(name) {
  return fs.readFileSync(path.join(__dirname, '../fixtures', name), 'utf8');
}

beforeEach(() => {
  document.documentElement.innerHTML = loadFixture('google-paa.html');
});

test('scrapeGooglePAA returns all visible PAA questions', () => {
  const result = scrapeGooglePAA(document);

  expect(result.questions.length).toBeGreaterThanOrEqual(1);
});

test('scrapeGooglePAA returns questions as strings', () => {
  const result = scrapeGooglePAA(document);

  result.questions.forEach(q => expect(typeof q).toBe('string'));
  expect(result.questions.some(q => q.includes('martial arts'))).toBe(true);
});

test('scrapeGooglePAA returns empty questions array on empty page', () => {
  document.documentElement.innerHTML = '<html><body></body></html>';

  const result = scrapeGooglePAA(document);

  expect(result.questions).toEqual([]);
});
