const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const MODELS = {
  claude:  { extract: 'claude-haiku-4-5-20251001', synthesize: 'claude-sonnet-4-6' },
  openai:  { extract: 'gpt-4o-mini',               synthesize: 'gpt-4o' },
};

const ERROR_MESSAGES = {
  401: 'Invalid API key. Check your API key in Settings.',
  429: 'Rate limited. Wait a moment and try again.',
  529: 'API is overloaded. Try again in a few seconds.',
};

async function callClaude(prompt, apiKey, model) {
  const response = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(ERROR_MESSAGES[response.status] || `Claude API error (${response.status}).`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? '';
}

async function callOpenAI(prompt, apiKey, model) {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(ERROR_MESSAGES[response.status] || `OpenAI API error (${response.status}).`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callAI(prompt, settings, modelKey) {
  const provider = settings.provider || 'claude';
  const models = MODELS[provider] || MODELS.claude;
  const model = models[modelKey];

  if (provider === 'openai') {
    return callOpenAI(prompt, settings.openaiApiKey, model);
  }
  return callClaude(prompt, settings.apiKey, model);
}

function parseNumberedList(text) {
  return text
    .split('\n')
    .map(line => line.replace(/^\d+[.)]\s*/, '').trim())
    .filter(line => line.length > 10);
}

async function extractQuestions(prompt, settings) {
  const text = await callAI(prompt, settings, 'extract');
  return parseNumberedList(text);
}

async function synthesize(prompt, settings) {
  return callAI(prompt, settings, 'synthesize');
}

if (typeof module !== 'undefined') {
  module.exports = { extractQuestions, synthesize };
}
