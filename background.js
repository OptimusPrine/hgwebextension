importScripts('src/questionbank.js', 'src/prompts.js', 'src/ai.js');

const LAST_SYNTHESIS_KEY = 'lastSynthesis';

const SETTINGS_KEY = 'settings';

async function getSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return result[SETTINGS_KEY] || {};
}

// The local provider authenticates through the Claude Code proxy, so it needs no
// API key. Returns an error string when a key is required but missing, else null.
function missingKeyError(settings) {
  if (settings.provider === 'local') return null;
  const hasKey = settings.provider === 'openai' ? settings.openaiApiKey : settings.apiKey;
  if (hasKey) return null;
  const which = settings.provider === 'openai' ? 'OpenAI' : 'Claude';
  return `No ${which} API key set. Please add it in Settings.`;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(err => {
    console.error('Background error:', err);
    sendResponse({ error: err.message });
  });
  return true;
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'SITE_DETECTED':
      return { ok: true };

    case 'CAPTURE_REQUESTED': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return { error: 'No active tab' };

      let contentResponse;
      try {
        contentResponse = await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_REQUESTED' });
      } catch {
        return { error: 'Could not connect to page. Try refreshing.' };
      }

      if (!contentResponse || contentResponse.type === 'CAPTURE_ERROR') {
        return { error: contentResponse?.message || 'No response from page. Try refreshing.' };
      }

      const { source, content, scanned = 0 } = contentResponse;

      // Notify sidebar of scan count before the (slow) API call
      chrome.runtime.sendMessage({ type: 'CAPTURE_PROGRESS', source, scanned }).catch(() => {});

      const settings = await getSettings();

      const keyErr = missingKeyError(settings);
      if (keyErr) return { error: keyErr };

      const rawText = typeof content === 'string' ? content
        : content.text || [content.title, content.body, ...(content.comments || [])].join('\n');

      const prompt = assemblePrompt(source, rawText, settings.icp || {});
      if (!prompt) return { error: `Source "${source}" not supported.` };

      const questions = await extractQuestions(prompt, settings);
      if (questions.length > 0) {
        await addQuestions(questions, source);
      }

      return { questions, count: questions.length, scanned, source };
    }

    case 'SYNTHESIZE_REQUESTED': {
      const settings = await getSettings();
      const keyErr = missingKeyError(settings);
      if (keyErr) return { error: keyErr };

      const allQuestions = await getAllQuestions();
      if (allQuestions.length === 0) {
        return { error: 'Question bank is empty. Capture some content first.' };
      }

      const questionTexts = allQuestions.map(q => q.text);
      const prompt = assembleMasterPrompt(questionTexts, settings.icp || {});
      const markdown = await synthesize(prompt, settings);

      return { markdown };
    }

    case 'GET_SETTINGS':
      return getSettings();

    case 'SAVE_SETTINGS': {
      await chrome.storage.local.set({ [SETTINGS_KEY]: message.settings });
      return { ok: true };
    }

    case 'GET_BANK': {
      const questions = await getAllQuestions();
      return { questions };
    }

    case 'CLEAR_BANK': {
      await clearBank();
      return { ok: true };
    }

    case 'SAVE_SYNTHESIS': {
      // Store the tail of the synthesis — the gaps section lives there
      const snippet = (message.markdown || '').slice(-1500);
      await chrome.storage.local.set({ [LAST_SYNTHESIS_KEY]: snippet });
      return { ok: true };
    }

    case 'SUGGEST_SEARCHES_REQUESTED': {
      const settings = await getSettings();
      const keyErr = missingKeyError(settings);
      if (keyErr) return { error: keyErr };

      const allQuestions = await getAllQuestions();
      if (allQuestions.length === 0) {
        return { error: 'No questions in bank yet. Capture some content first.' };
      }

      const stored = await chrome.storage.local.get(LAST_SYNTHESIS_KEY);
      const lastSynthesis = stored[LAST_SYNTHESIS_KEY] || '';

      const questionTexts = allQuestions.map(q => q.text);
      const prompt = assembleSuggestionsPrompt(questionTexts, settings.icp || {}, lastSynthesis);
      const text = await synthesize(prompt, settings);
      const suggestions = parseSuggestions(text);

      return { suggestions };
    }

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}
