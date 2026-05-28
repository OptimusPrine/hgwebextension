function scrapeG2Reviews(doc) {
  const reviews = [];

  // Each review card — selector verified May 2026
  const reviewBodies = doc.querySelectorAll('[itemprop="reviewBody"], .paper--box [itemprop="reviewBody"]');

  if (reviewBodies.length > 0) {
    reviewBodies.forEach(body => {
      const text = body.textContent?.trim();
      if (text) reviews.push(text);
    });
  } else {
    // Fallback: grab all formatted-text blocks inside review containers
    const textEls = doc.querySelectorAll('.paper--box .formatted-text');
    textEls.forEach(el => {
      const text = el.textContent?.trim();
      if (text) reviews.push(text);
    });
  }

  return { reviews };
}

function formatForCapture(scraped) {
  return scraped.reviews.join('\n---\n');
}

if (typeof chrome !== 'undefined' && chrome.runtime && !window.__bqmG2Registered) {
  window.__bqmG2Registered = true;
  chrome.runtime.sendMessage({ type: 'SITE_DETECTED', source: 'g2' });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'CAPTURE_REQUESTED') {
      const scraped = scrapeG2Reviews(document);
      if (scraped.reviews.length === 0) {
        sendResponse({ type: 'CAPTURE_ERROR', message: 'No reviews found on this page.' });
        return true;
      }
      sendResponse({
        type: 'CONTENT_SCRAPED',
        source: 'g2',
        content: { text: formatForCapture(scraped) },
        scanned: scraped.reviews.length,
      });
    }
    return true;
  });
}

if (typeof module !== 'undefined') module.exports = { scrapeG2Reviews };
