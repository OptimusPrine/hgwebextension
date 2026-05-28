function scrapeReddit(doc) {
  // ── Title ────────────────────────────────────────────────────────────────────
  const titleEl = doc.querySelector([
    'h1[slot="title"]',           // shreddit post (2024+)
    '[data-testid="post-title"]', // old new Reddit
    '.Post h1',
    'h1',
  ].join(', '));
  const title = titleEl?.textContent?.trim()
    || doc.querySelector('.title a.title')?.textContent?.trim()  // old Reddit
    || '';

  // ── Post body ─────────────────────────────────────────────────────────────────
  const bodyEl = doc.querySelector([
    'shreddit-post [slot="text-body"]',   // shreddit (2024+)
    '[data-click-id="text"] .md',
    '[data-testid="post-rtjson-content"]',
    '.Post .md',
  ].join(', '));
  const body = bodyEl?.textContent?.trim()
    || doc.querySelector('.usertext-body .md')?.textContent?.trim()  // old Reddit
    || '';

  // ── Comments ──────────────────────────────────────────────────────────────────
  const comments = [];

  // shreddit-comment (newest Reddit, 2024+)
  // Comment text lives in paragraph tags in the light DOM beneath shreddit-comment
  const shredditComments = doc.querySelectorAll('shreddit-comment');
  shredditComments.forEach(el => {
    const paras = el.querySelectorAll('p, .md p');
    const text = Array.from(paras)
      .map(p => p.textContent.trim())
      .filter(t => t.length > 0)
      .join(' ');
    if (text.length > 15) comments.push(text);
  });

  // Fallback: older new Reddit data-testid pattern
  if (comments.length === 0) {
    doc.querySelectorAll('[data-testid="comment"]').forEach(el => {
      const text = el.querySelector('.md, p')?.textContent?.trim();
      if (text && text.length > 15) comments.push(text);
    });
  }

  // Fallback: old Reddit (.usertext-body after the first, which is the post body)
  if (comments.length === 0) {
    const oldCommentEls = doc.querySelectorAll('.usertext-body .md');
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
      // Count the post itself (title/body) as 1 item plus any comments
      const postSections = (content.title || content.body) ? 1 : 0;
      const scanned = postSections + content.comments.length;
      sendResponse({ type: 'CONTENT_SCRAPED', source: 'reddit', content, scanned });
    }
    return true;
  });
}

if (typeof module !== 'undefined') module.exports = { scrapeReddit };
