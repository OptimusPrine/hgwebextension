function scrapeReddit(doc) {
  const titleEl = doc.querySelector('[data-testid="post-title"], h1[slot="title"], h1');
  const bodyEl = doc.querySelector('[data-testid="post-rtjson-content"], [data-click-id="text"]');
  const commentEls = doc.querySelectorAll('[data-testid^="comment-"]');

  // Old Reddit fallback
  const oldTitleEl = doc.querySelector('.title a.title');
  const oldBodyEl = doc.querySelector('.usertext-body .md');
  const oldCommentEls = doc.querySelectorAll('.usertext-body .md');

  const title = titleEl?.textContent?.trim()
    || oldTitleEl?.textContent?.trim()
    || '';

  const body = bodyEl?.textContent?.trim()
    || oldBodyEl?.textContent?.trim()
    || '';

  const comments = [];
  commentEls.forEach(el => {
    const text = el.textContent?.trim();
    if (text) comments.push(text);
  });

  // Old Reddit: comments after first (first is post body)
  if (comments.length === 0 && oldCommentEls.length > 1) {
    oldCommentEls.forEach((el, i) => {
      if (i === 0) return;
      const text = el.textContent?.trim();
      if (text) comments.push(text);
    });
  }

  return { title, body, comments };
}

if (typeof chrome !== 'undefined' && chrome.runtime && !window.__bqmRedditRegistered) {
  window.__bqmRedditRegistered = true;
  chrome.runtime.sendMessage({ type: 'SITE_DETECTED', source: 'reddit' });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'CAPTURE_REQUESTED') {
      const content = scrapeReddit(document);
      const scanned = content.comments.length + (content.body ? 1 : 0);
      sendResponse({ type: 'CONTENT_SCRAPED', source: 'reddit', content, scanned });
    }
    return true;
  });
}

if (typeof module !== 'undefined') module.exports = { scrapeReddit };
