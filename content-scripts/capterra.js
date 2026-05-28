function scrapeCapterraReviews(doc) {
  const reviews = [];

  // Capterra review structure — selector verified May 2026
  const reviewEls = doc.querySelectorAll('[data-testid="review-text"], .review-text, .pb-review-body');
  reviewEls.forEach(el => {
    const text = el.textContent?.trim();
    if (text) reviews.push(text);
  });

  return { reviews };
}

function formatForCapture(scraped) {
  return scraped.reviews.join('\n---\n');
}

if (typeof chrome !== 'undefined' && chrome.runtime && !window.__bqmCapterraRegistered) {
  window.__bqmCapterraRegistered = true;
  chrome.runtime.sendMessage({ type: 'SITE_DETECTED', source: 'capterra' });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'CAPTURE_REQUESTED') {
      const scraped = scrapeCapterraReviews(document);
      if (scraped.reviews.length === 0) {
        sendResponse({ type: 'CAPTURE_ERROR', message: 'No reviews found on this page.' });
        return true;
      }
      sendResponse({
        type: 'CONTENT_SCRAPED',
        source: 'capterra',
        content: { text: formatForCapture(scraped) },
        scanned: scraped.reviews.length,
      });
    }
    return true;
  });
}

if (typeof module !== 'undefined') module.exports = { scrapeCapterraReviews };
