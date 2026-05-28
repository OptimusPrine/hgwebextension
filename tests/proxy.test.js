const http = require('http');
const { createHandler } = require('../proxy/server');

// Spin up the real handler on an ephemeral port with a fake `runClaude` standing
// in for the external `claude` subprocess. Assertions are made against the HTTP
// response the extension would actually receive.
function startServer(runClaude) {
  const server = http.createServer(createHandler({ runClaude }));
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${port}/v1/messages`,
        close: () => new Promise(r => server.close(r)),
      });
    });
  });
}

test('POST forwards the prompt and model to claude and returns its text', async () => {
  const runClaude = async (prompt, model) => `MODEL=${model};OUT=${prompt.toUpperCase()}`;
  const { url, close } = await startServer(runClaude);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello', model: 'sonnet' }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.text).toBe('MODEL=sonnet;OUT=HELLO');
  } finally {
    await close();
  }
});

test('returns 500 with an error message when claude fails', async () => {
  const runClaude = async () => { throw new Error('not logged in'); };
  const { url, close } = await startServer(runClaude);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello', model: 'sonnet' }),
    });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toMatch(/not logged in/);
  } finally {
    await close();
  }
});

test('returns 400 when the prompt is missing', async () => {
  const runClaude = async () => 'should not be called';
  const { url, close } = await startServer(runClaude);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'sonnet' }),
    });
    expect(res.status).toBe(400);
  } finally {
    await close();
  }
});

test('rejects requests from web-page origins so a visited site cannot drive it', async () => {
  const { url, close } = await startServer(async () => 'should not run');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ prompt: 'hello', model: 'haiku' }),
    });
    expect(res.status).toBe(403);
  } finally {
    await close();
  }
});

test('allows requests from the extension origin', async () => {
  const { url, close } = await startServer(async () => 'ok');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'chrome-extension://abcdef' },
      body: JSON.stringify({ prompt: 'hello', model: 'haiku' }),
    });
    expect(res.status).toBe(200);
  } finally {
    await close();
  }
});

test('rejects an oversized request body', async () => {
  const { url, close } = await startServer(async () => 'should not run');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'a'.repeat(1_100_000), model: 'haiku' }),
    });
    expect(res.status).toBe(413);
  } finally {
    await close();
  }
});

test('answers CORS preflight so the extension can call it', async () => {
  const { url, close } = await startServer(async () => '');
  try {
    const res = await fetch(url, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  } finally {
    await close();
  }
});
