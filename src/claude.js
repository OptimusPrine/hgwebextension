const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const EXTRACT_MODEL = 'claude-haiku-4-5-20251001';
const SYNTHESIZE_MODEL = 'claude-sonnet-4-6';

async function callClaude(prompt, apiKey, model) {
  const response = await fetch(ANTHROPIC_API_URL, {
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
    const messages = {
      401: 'Invalid API key. Check your Claude API key in Settings.',
      429: 'Rate limited. Wait a moment and try again.',
      529: 'Claude API is overloaded. Try again in a few seconds.',
    };
    throw new Error(messages[response.status] || `Claude API error (${response.status}). Try again.`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? '';
}

function parseNumberedList(text) {
  return text
    .split('\n')
    .map(line => line.replace(/^\d+[.)]\s*/, '').trim())
    .filter(line => line.length > 10);
}

async function extractQuestions(prompt, apiKey) {
  const text = await callClaude(prompt, apiKey, EXTRACT_MODEL);
  return parseNumberedList(text);
}

async function synthesize(prompt, apiKey) {
  return callClaude(prompt, apiKey, SYNTHESIZE_MODEL);
}

if (typeof module !== 'undefined') {
  module.exports = { extractQuestions, synthesize };
}
