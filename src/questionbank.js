const STORAGE_KEY = 'questionBank';

async function getAllQuestions() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

async function addQuestions(questions, source) {
  // Read inside the set operation to avoid losing concurrent writes
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const existing = result[STORAGE_KEY] || [];
      const timestamp = Date.now();
      const newEntries = questions.map(text => ({ text, source, timestamp }));
      chrome.storage.local.set({ [STORAGE_KEY]: [...existing, ...newEntries] }, resolve);
    });
  });
}

async function getQuestionsBySource(source) {
  const all = await getAllQuestions();
  return all.filter(q => q.source === source);
}

async function clearBank() {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
}

if (typeof module !== 'undefined') {
  module.exports = { addQuestions, getAllQuestions, getQuestionsBySource, clearBank };
}
