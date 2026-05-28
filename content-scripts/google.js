function scrapeGooglePAA(doc) {
  const questions = [];

  // PAA boxes — selector verified May 2026; Google DOM changes frequently
  const paaEls = doc.querySelectorAll('.related-question-pair .JlqpRe, [data-ved] .iDjcJe, .related-question-pair span[jsname]');
  paaEls.forEach(el => {
    const text = el.textContent?.trim();
    if (text) questions.push(text);
  });

  // Autocomplete suggestions (only present if suggestions drawer is open)
  const autocompleteEls = doc.querySelectorAll('.sbqs_c, [data-ved] .pcl2rf');
  autocompleteEls.forEach(el => {
    const text = el.textContent?.trim();
    if (text && !questions.includes(text)) questions.push(text);
  });

  return { questions };
}

if (typeof chrome !== 'undefined' && chrome.runtime && !window.__bqmGoogleRegistered) {
  window.__bqmGoogleRegistered = true;
  chrome.runtime.sendMessage({ type: 'SITE_DETECTED', source: 'google' });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'CAPTURE_REQUESTED') {
      const content = scrapeGooglePAA(document);
      sendResponse({ type: 'CONTENT_SCRAPED', source: 'google', content });
    }
    return true;
  });
}

if (typeof module !== 'undefined') module.exports = { scrapeGooglePAA };
