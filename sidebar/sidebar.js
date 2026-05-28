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
async function loadSettings() {
  const settings = await msg('GET_SETTINGS');
  const icp = settings.icp || {};
  setVal('vc-apikey', settings.apiKey);
  setVal('vc-product', icp.product);
  setVal('vc-description', icp.description);
  setVal('vc-price', icp.price);
  setVal('vc-competitors', Array.isArray(icp.competitors) ? icp.competitors.join(', ') : icp.competitors);
}

function readSettings() {
  const competitors = (get('vc-competitors') || '').split(',').map(s => s.trim()).filter(Boolean);
  return {
    apiKey: get('vc-apikey'),
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
  await refreshBank();
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
  feedback.textContent = 'Capturing…';
  feedback.className = 'vc-feedback';

  const result = await msg('CAPTURE_REQUESTED');

  if (result.error) {
    feedback.textContent = result.error;
    feedback.className = 'vc-feedback error';
    return;
  }

  feedback.textContent = `✓ ${result.count} questions added`;
  feedback.className = 'vc-feedback success';
  await refreshBank();
}

// ── Synthesize ────────────────────────────────────────────────────────────────
async function handleSynthesize() {
  const output = el('vc-output');
  const copyBtn = el('vc-copy-btn');
  output.classList.remove('hidden');
  output.textContent = 'Running synthesis… (this may take 30–60 seconds)';
  copyBtn.classList.add('hidden');

  const result = await msg('SYNTHESIZE_REQUESTED');

  if (result.error) {
    output.textContent = 'Error: ' + result.error;
    return;
  }

  output.textContent = result.markdown;
  copyBtn.classList.remove('hidden');
  copyBtn.onclick = () => navigator.clipboard.writeText(result.markdown);
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }
function get(id) { return el(id)?.value?.trim() || ''; }
function setVal(id, val) { const e = el(id); if (e && val != null) e.value = val; }
function escHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Listen for site detection from content scripts ────────────────────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SITE_DETECTED') updateSiteBadge(message.source);
});

// ── Boot ──────────────────────────────────────────────────────────────────────
async function init() {
  initTabs();
  initDarkMode();

  await loadSettings();
  await refreshBank();

  el('vc-search').addEventListener('input', renderBank);
  el('vc-source-filter').addEventListener('change', renderBank);

  el('vc-capture-btn').addEventListener('click', handleCapture);
  el('vc-synth-btn').addEventListener('click', handleSynthesize);
  el('vc-save-btn').addEventListener('click', handleSave);
  el('vc-clear-btn').addEventListener('click', handleClear);
}

init();
