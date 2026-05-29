function msg(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}

// ── Tab switching ────────────────────────────────────────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll('.vc-rail-btn[data-tab]');
  const panes = document.querySelectorAll('.vc-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      panes.forEach(p => p.classList.toggle('hidden', p.dataset.pane !== target));
    });
  });
}

// ── Dark mode ────────────────────────────────────────────────────────────────
function initDarkMode() {
  const toggle = document.getElementById('vc-dark-toggle');
  const saved = localStorage.getItem('darkMode');
  const isDark = saved === 'true';
  applyDark(isDark);

  toggle.addEventListener('click', () => {
    const next = !document.body.classList.contains('dark');
    applyDark(next);
    localStorage.setItem('darkMode', next);
  });
}

function applyDark(on) {
  document.body.classList.toggle('dark', on);
  document.getElementById('vc-dark-toggle').textContent = on ? '☀' : '🌙';
}

// ── Settings ─────────────────────────────────────────────────────────────────
function initProviderToggle() {
  const btns = document.querySelectorAll('.vc-provider-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function getSelectedProvider() {
  const active = document.querySelector('.vc-provider-btn.active');
  return active?.dataset.provider || 'claude';
}

function setSelectedProvider(provider) {
  document.querySelectorAll('.vc-provider-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.provider === provider);
  });
}

async function loadSettings() {
  const settings = await msg('GET_SETTINGS');
  const icp = settings.icp || {};
  setSelectedProvider(settings.provider || 'claude');
  setVal('vc-apikey', settings.apiKey);
  setVal('vc-openai-apikey', settings.openaiApiKey);
  setVal('vc-local-url', settings.localProxyUrl);
  setVal('vc-local-extract-model', settings.localExtractModel || 'haiku');
  setVal('vc-local-synth-model', settings.localSynthesizeModel || 'sonnet');
  promptOverrides = settings.prompts || {};
  setVal('vc-product', icp.product);
  setVal('vc-description', icp.description);
  setVal('vc-price', icp.price);
  setVal('vc-competitors', Array.isArray(icp.competitors) ? icp.competitors.join(', ') : icp.competitors);
}

function readSettings() {
  stashCurrentPrompt();
  const competitors = (get('vc-competitors') || '').split(',').map(s => s.trim()).filter(Boolean);
  return {
    provider: getSelectedProvider(),
    apiKey: get('vc-apikey'),
    openaiApiKey: get('vc-openai-apikey'),
    localProxyUrl: get('vc-local-url'),
    localExtractModel: get('vc-local-extract-model') || 'haiku',
    localSynthesizeModel: get('vc-local-synth-model') || 'sonnet',
    prompts: promptOverrides,
    icp: {
      product: get('vc-product'),
      description: get('vc-description'),
      price: get('vc-price'),
      competitors,
    },
  };
}

async function handleSave() {
  await msg('SAVE_SETTINGS', { settings: readSettings() });
  const savedEl = el('vc-saved');
  savedEl.classList.remove('hidden');
  setTimeout(() => savedEl.classList.add('hidden'), 2000);
}

// ── Prompt template editor ─────────────────────────────────────────────────────
// promptDefaults comes from the background (which owns the canonical templates).
// promptOverrides holds only the prompts the user has actually changed; an entry
// equal to the default (or empty) is dropped so storage stays clean.
let promptDefaults = {};
let promptOverrides = {};
let currentPromptId = 'master';

function defaultPrompt(id) {
  return promptDefaults[id] || '';
}

function stashCurrentPrompt() {
  const textarea = el('vc-prompt-text');
  if (!textarea) return;
  // If defaults never loaded, the editor is empty for the wrong reason — don't
  // let that delete a real override the user had saved.
  if (!Object.keys(promptDefaults).length) return;
  const val = textarea.value;
  // Empty or whitespace-only means "use the default", not "send a blank prompt".
  if (!val.trim() || val === defaultPrompt(currentPromptId)) {
    delete promptOverrides[currentPromptId];
  } else {
    promptOverrides[currentPromptId] = val;
  }
}

function loadPromptIntoEditor(id) {
  currentPromptId = id;
  const textarea = el('vc-prompt-text');
  if (textarea) textarea.value = promptOverrides[id] ?? defaultPrompt(id);
}

async function initPromptEditor() {
  const sel = el('vc-prompt-select');
  if (!sel) return;
  const { prompts } = await msg('GET_DEFAULT_PROMPTS');
  promptDefaults = prompts || {};
  loadPromptIntoEditor(sel.value);

  sel.addEventListener('change', () => {
    stashCurrentPrompt();            // stash the prompt we're leaving (currentPromptId)
    loadPromptIntoEditor(sel.value); // then switch to the newly selected one
  });
  el('vc-prompt-reset')?.addEventListener('click', () => {
    delete promptOverrides[currentPromptId];
    const textarea = el('vc-prompt-text');
    if (textarea) textarea.value = defaultPrompt(currentPromptId);
  });
}

// ── Bank ──────────────────────────────────────────────────────────────────────
let allQuestions = [];

async function refreshBank() {
  const { questions } = await msg('GET_BANK');
  allQuestions = questions;
  updateCount(questions.length);
  renderBank();
}

function updateCount(count) {
  if (el('vc-count')) el('vc-count').textContent = count;
  if (el('vc-bank-count')) el('vc-bank-count').textContent = count;
  el('vc-suggest-wrap')?.classList.toggle('hidden', count === 0);
}

function renderBank() {
  const filterText = el('vc-search')?.value?.toLowerCase() || '';
  const filterSource = el('vc-source-filter')?.value || '';
  const list = el('vc-question-list');
  if (!list) return;
  list.innerHTML = '';

  const filtered = allQuestions.filter(q => {
    const matchesText = !filterText || q.text.toLowerCase().includes(filterText);
    const matchesSource = !filterSource || q.source === filterSource;
    return matchesText && matchesSource;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<li style="color:var(--muted);padding:8px;font-size:11px;">${
      allQuestions.length === 0 ? 'No questions yet. Capture some content first.' : 'No matches.'
    }</li>`;
    return;
  }

  filtered.forEach(q => {
    const item = document.createElement('li');
    item.innerHTML = `<span class="vc-source-tag">${escHtml(q.source)}</span><span class="vc-q-text">${escHtml(q.text)}</span>`;
    list.appendChild(item);
  });
}

async function handleClear() {
  if (!confirm('Clear all captured questions? This cannot be undone.')) return;
  await msg('CLEAR_BANK');
  await msg('SAVE_BLOG_TOPICS', { topics: [] });
  blogTopics = [];
  renderBlogList();
  await refreshBank();
}

// ── Source item labels ────────────────────────────────────────────────────────
const SOURCE_LABELS = {
  reddit:   { one: 'post section', many: 'post + comments' },
  google:   { one: 'PAA question', many: 'PAA questions' },
  g2:       { one: 'review',       many: 'reviews' },
  capterra: { one: 'review',       many: 'reviews' },
  youtube:  { one: 'comment',      many: 'comments' },
};

function itemLabel(source, count) {
  const label = SOURCE_LABELS[source] || { one: 'item', many: 'items' };
  return `${count} ${count === 1 ? label.one : label.many}`;
}

// ── Capture ───────────────────────────────────────────────────────────────────
function updateSiteBadge(source) {
  const badge = el('vc-site-badge');
  const captureBtn = el('vc-capture-btn');
  if (!badge) return;

  if (source) {
    badge.textContent = `${source.charAt(0).toUpperCase() + source.slice(1)} detected`;
    badge.className = 'vc-detect-badge detected';
    captureBtn.disabled = false;
  } else {
    badge.textContent = 'No site detected';
    badge.className = 'vc-detect-badge';
    captureBtn.disabled = true;
  }
}

async function handleCapture() {
  const feedback = el('vc-feedback');
  setFeedback(feedback, 'Scanning page…', 'scanning');

  const result = await msg('CAPTURE_REQUESTED');

  if (result.error) {
    setFeedback(feedback, result.error, 'error');
    return;
  }

  const scannedLabel = itemLabel(result.source, result.scanned);
  setFeedback(feedback, `✓ ${result.count} questions extracted from ${scannedLabel}`, 'success');
  await refreshBank();
}

function setFeedback(el, text, state) {
  el.textContent = text;
  el.className = `vc-feedback${state ? ' ' + state : ''}`;
}

// ── Synthesize ────────────────────────────────────────────────────────────────
let lastMarkdown = '';

async function handleSynthesize() {
  const output = el('vc-output');
  const exportRow = el('vc-export-row');
  output.classList.remove('hidden');
  exportRow.classList.add('hidden');

  const startedAt = Date.now();
  const tick = () => { output.textContent = `Running synthesis… ${Math.round((Date.now() - startedAt) / 1000)}s elapsed`; };
  tick();
  const ticker = setInterval(tick, 1000);

  let result;
  try {
    result = await msg('SYNTHESIZE_REQUESTED');
  } finally {
    clearInterval(ticker);
  }

  if (result.error) {
    output.textContent = 'Error: ' + result.error;
    return;
  }

  lastMarkdown = result.markdown;
  output.textContent = result.markdown;
  exportRow.classList.remove('hidden');
  el('vc-copy-btn').onclick = () => navigator.clipboard.writeText(lastMarkdown);
  el('vc-pdf-btn').onclick = () => exportPdf(lastMarkdown);

  // Save synthesis tail so suggest-searches can use the gap analysis
  msg('SAVE_SYNTHESIS', { markdown: lastMarkdown }).catch(() => {});

  // Parse and persist top 10 for blog tab
  blogTopics = parseBuildTheseFirst(lastMarkdown);
  msg('SAVE_BLOG_TOPICS', { topics: blogTopics }).catch(() => {});
  renderBlogList();
}

// ── Suggest searches ──────────────────────────────────────────────────────────
async function handleSuggestSearches() {
  const btn = el('vc-suggest-btn');
  const results = el('vc-suggest-results');
  const errEl = el('vc-suggest-error');

  btn.textContent = 'Thinking…';
  btn.disabled = true;
  results.classList.add('hidden');
  errEl.classList.add('hidden');

  const result = await msg('SUGGEST_SEARCHES_REQUESTED');

  btn.textContent = 'Suggest searches';
  btn.disabled = false;

  if (result.error) {
    errEl.textContent = result.error;
    errEl.classList.remove('hidden');
    return;
  }

  renderSuggestions('vc-reddit-list', result.suggestions.reddit, 'reddit');
  renderSuggestions('vc-google-list', result.suggestions.google, 'google');
  results.classList.remove('hidden');
}

function renderSuggestions(listId, queries, platform) {
  const list = el(listId);
  list.innerHTML = '';
  if (!queries.length) {
    list.innerHTML = '<li style="color:var(--muted);font-size:11px;padding:4px 0">No suggestions returned.</li>';
    return;
  }
  queries.forEach(query => {
    const url = platform === 'reddit'
      ? `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`
      : `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const li = document.createElement('li');
    li.innerHTML = `<a href="${url}" target="_blank">${escHtml(query)}</a>`;
    list.appendChild(li);
  });
}

// ── Blog tab ──────────────────────────────────────────────────────────────────
function extractListItem(raw) {
  let text = raw.trim().replace(/\*\*/g, '');
  const q = text.indexOf('?');
  if (q !== -1) return text.slice(0, q + 1).trim();
  const p = text.indexOf('.');
  if (p !== -1) return text.slice(0, p + 1).trim();
  return text.trim();
}

function parseBuildTheseFirst(markdown) {
  const lines = markdown.split('\n');
  const headingRe = /^(#{1,3}\s+|\*\*)(build these first|step 6|top 10)/i;
  let headingFound = false;
  let results = [];
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (headingRe.test(trimmed)) { inSection = true; headingFound = true; continue; }
    if (inSection && /^(#{1,3}\s|\*\*\S)/.test(trimmed)) break;
    if (!inSection) continue;
    const m = trimmed.match(/^\d+[.)]\s+(.+)/);
    if (!m) continue;
    const text = extractListItem(m[1]);
    if (text) results.push(text);
  }

  if (headingFound) return results;

  // Fallback: top-10 is always the last multi-item numbered list in the doc
  let currentList = [];
  let lastNum = 0;
  let bestList = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (!m) continue;
    const num = parseInt(m[1], 10);
    if (num === 1) { currentList = []; lastNum = 0; }
    if (num !== lastNum + 1) continue;
    lastNum = num;
    const text = extractListItem(m[2]);
    if (text) currentList.push(text);
    if (currentList.length >= 5) bestList = [...currentList];
  }

  return bestList;
}

let blogTopics = [];
let lastBlogPost = null;

async function initBlogTab() {
  const { topics } = await msg('GET_BLOG_TOPICS');
  if (topics && topics.length > 0) {
    blogTopics = topics;
    renderBlogList();
  }
}

function renderBlogList() {
  const list = el('vc-blog-list');
  const hint = el('vc-blog-hint');
  list.innerHTML = '';

  if (!blogTopics.length) {
    hint.classList.remove('hidden');
    return;
  }
  hint.classList.add('hidden');

  blogTopics.forEach((question, i) => {
    const li = document.createElement('li');
    li.className = 'vc-blog-card';
    li.innerHTML = `
      <span class="vc-blog-card-number">${i + 1}</span>
      <span class="vc-blog-card-question">${escHtml(question)}</span>
      <button class="vc-btn-secondary vc-blog-generate-btn" data-index="${i}">Generate post</button>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll('.vc-blog-generate-btn').forEach(btn => {
    btn.addEventListener('click', () => handleGeneratePost(blogTopics[+btn.dataset.index], btn));
  });
}

async function handleGeneratePost(question, btn) {
  const outputWrap = el('vc-blog-output-wrap');
  const status = el('vc-blog-status');
  const fields = el('vc-blog-fields');
  const allBtns = document.querySelectorAll('.vc-blog-generate-btn');

  btn.textContent = 'Writing…';
  allBtns.forEach(b => b.disabled = true);
  outputWrap.classList.remove('hidden');
  fields.classList.add('hidden');

  const startedAt = Date.now();
  const tick = () => { status.textContent = `Generating blog post… ${Math.round((Date.now() - startedAt) / 1000)}s elapsed`; };
  tick();
  const ticker = setInterval(tick, 1000);

  let result;
  try {
    result = await msg('GENERATE_BLOG_POST', { question });
  } finally {
    clearInterval(ticker);
  }

  btn.textContent = 'Generate post';
  allBtns.forEach(b => b.disabled = false);

  if (result.error) {
    status.textContent = 'Error: ' + result.error;
    return;
  }

  lastBlogPost = result.post;
  status.textContent = '';
  el('vc-blog-title').textContent = lastBlogPost.title;
  el('vc-blog-excerpt').textContent = lastBlogPost.excerpt;
  el('vc-blog-meta').textContent = lastBlogPost.metaDescription;
  el('vc-blog-content').textContent = lastBlogPost.contentHtml;
  fields.classList.remove('hidden');

  // Each field copies its own plain value (HTML body copies the raw markup).
  fields.querySelectorAll('.vc-blog-copy').forEach(b => {
    b.onclick = () => navigator.clipboard.writeText(lastBlogPost[b.dataset.copy] || '');
  });
}

// ── PDF export ────────────────────────────────────────────────────────────────
function markdownToHtml(md) {
  const lines = md.split('\n');
  const html = [];
  let inTable = false;
  let inList = false;
  let tableHasHead = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headings
    if (line.startsWith('### ')) { closeBlocks(); html.push(`<h3>${inline(line.slice(4))}</h3>`); continue; }
    if (line.startsWith('## '))  { closeBlocks(); html.push(`<h2>${inline(line.slice(3))}</h2>`); continue; }
    if (line.startsWith('# '))   { closeBlocks(); html.push(`<h1>${inline(line.slice(2))}</h1>`); continue; }

    // Tables
    if (line.startsWith('|')) {
      if (!inTable) { html.push('<table><thead>'); inTable = true; tableHasHead = false; }
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      const isSeparator = cells.every(c => /^[-: ]+$/.test(c));
      if (isSeparator) {
        html.push('</thead><tbody>');
        tableHasHead = true;
      } else {
        const tag = (!tableHasHead) ? 'th' : 'td';
        html.push('<tr>' + cells.map(c => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>');
      }
      continue;
    } else if (inTable) {
      html.push('</tbody></table>');
      inTable = false;
    }

    // Numbered lists
    if (/^\d+\.\s/.test(line)) {
      if (!inList) { html.push('<ol>'); inList = 'ol'; }
      html.push(`<li>${inline(line.replace(/^\d+\.\s/, ''))}</li>`);
      continue;
    }

    // Bullet lists
    if (/^[-*]\s/.test(line)) {
      if (!inList) { html.push('<ul>'); inList = 'ul'; }
      html.push(`<li>${inline(line.replace(/^[-*]\s/, ''))}</li>`);
      continue;
    }

    // Close open list
    if (inList && line.trim() === '') {
      html.push(`</${inList}>`);
      inList = false;
    }

    // Blank line or paragraph
    if (line.trim() === '') { html.push('<br>'); continue; }
    html.push(`<p>${inline(line)}</p>`);
  }

  closeBlocks();
  return html.join('\n');

  function closeBlocks() {
    if (inTable) { html.push('</tbody></table>'); inTable = false; }
    if (inList)  { html.push(`</${inList}>`);      inList = false; }
  }

  function inline(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/`(.+?)`/g,       '<code>$1</code>');
  }
}

function exportPdf(markdown) {
  const html = markdownToHtml(markdown);
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Buyer-Question Map</title>
<style>
  body { font-family: -apple-system, sans-serif; font-size: 13px; color: #111; max-width: 960px; margin: 40px auto; padding: 0 24px; }
  h1 { font-size: 22px; border-bottom: 2px solid #111; padding-bottom: 8px; }
  h2 { font-size: 17px; margin-top: 32px; color: #1a1a1a; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 14px; margin-top: 20px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 12px; }
  th { background: #f3f4f6; text-align: left; padding: 7px 10px; border: 1px solid #d1d5db; font-weight: 600; }
  td { padding: 6px 10px; border: 1px solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  ol, ul { margin: 8px 0; padding-left: 20px; }
  li { margin: 4px 0; line-height: 1.5; }
  p { margin: 6px 0; line-height: 1.6; }
  strong { font-weight: 600; }
  code { background: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-size: 11px; }
  @media print {
    body { margin: 0; padding: 16px; }
    h2 { page-break-before: auto; }
    table { page-break-inside: avoid; }
  }
</style>
</head>
<body>${html}</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }
function get(id) { return el(id)?.value?.trim() || ''; }
function setVal(id, val) { const e = el(id); if (e && val != null) e.value = val; }
function escHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Listen for messages from background / content scripts ─────────────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SITE_DETECTED') {
    updateSiteBadge(message.source);
  }
  if (message.type === 'CAPTURE_PROGRESS') {
    const feedback = el('vc-feedback');
    const scannedLabel = itemLabel(message.source, message.scanned);
    setFeedback(feedback, `Found ${scannedLabel} — extracting questions…`, 'scanning');
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────
async function init() {
  initTabs();
  initDarkMode();
  initProviderToggle();

  await loadSettings();
  await initPromptEditor();
  await refreshBank();
  await initBlogTab();

  el('vc-search').addEventListener('input', renderBank);
  el('vc-source-filter').addEventListener('change', renderBank);

  el('vc-capture-btn').addEventListener('click', handleCapture);
  el('vc-suggest-btn').addEventListener('click', handleSuggestSearches);
  el('vc-synth-btn').addEventListener('click', handleSynthesize);
  el('vc-save-btn').addEventListener('click', handleSave);
  el('vc-clear-btn').addEventListener('click', handleClear);
}

init();
