function scrapeYoutubeComments(doc) {
  const comments = [];

  const commentEls = doc.querySelectorAll('ytd-comment-thread-renderer #content-text');
  commentEls.forEach(el => {
    const text = el.textContent?.trim();
    if (text) comments.push(text);
  });

  return { comments };
}

function formatForCapture(scraped) {
  return scraped.comments.join('\n---\n');
}

if (typeof chrome !== 'undefined' && chrome.runtime && !window.__bqmYoutubeRegistered) {
  window.__bqmYoutubeRegistered = true;
  chrome.runtime.sendMessage({ type: 'SITE_DETECTED', source: 'youtube' });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'CAPTURE_REQUESTED') {
      const scraped = scrapeYoutubeComments(document);

      if (scraped.comments.length === 0) {
        sendResponse({
          type: 'CAPTURE_ERROR',
          message: 'No comments loaded yet. Scroll down to load comments, then try again.',
        });
        return true;
      }

      sendResponse({
        type: 'CONTENT_SCRAPED',
        source: 'youtube',
        content: { text: formatForCapture(scraped) },
        scanned: scraped.comments.length,
      });
    }
    return true;
  });
}

if (typeof module !== 'undefined') module.exports = { scrapeYoutubeComments };
