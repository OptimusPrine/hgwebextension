const { spawn } = require('child_process');
const os = require('os');

// Replaces Claude Code's coding-agent system prompt with a neutral one and runs
// with no tools, so the model just transforms text instead of trying to act on a
// repo. Auth comes from the user's existing `claude` login (Max subscription).
const SYSTEM_PROMPT =
  'You are a precise text-processing assistant. Follow the user instructions exactly ' +
  'and return only the requested output, with no preamble or commentary.';

const REQUEST_TIMEOUT_MS = 120000;

// Contract this depends on (verified against claude 2.1.x):
//   claude -p ... --output-format json  →  { is_error: bool, result: string }
//   prompt is read from stdin. `--tools ""` disables tools.
//   `--setting-sources project,local` + a neutral cwd keep the global/project
//   CLAUDE.md memory out of the context (auth still loads from credentials).
// If a future CLI release changes these, the proxy breaks here — re-verify flags.
function runClaude(prompt, model) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--model', model,
      '--tools', '',
      '--setting-sources', 'project,local',
      '--system-prompt', SYSTEM_PROMPT,
      '--output-format', 'json',
    ];
    const child = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: os.tmpdir(),
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = fn => { if (!settled) { settled = true; clearTimeout(timer); fn(); } };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(() => reject(new Error(`claude timed out after ${REQUEST_TIMEOUT_MS}ms.`)));
    }, REQUEST_TIMEOUT_MS);

    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', err => finish(() => reject(new Error(`Could not launch claude: ${err.message}`))));
    child.on('close', code => finish(() => {
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `claude exited with code ${code}`));
      }
      let data;
      try {
        data = JSON.parse(stdout);
      } catch {
        return reject(new Error('Could not parse claude output as JSON.'));
      }
      if (data.is_error) return reject(new Error(data.result || 'claude returned an error.'));
      resolve(data.result || '');
    }));

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

const MAX_BODY_BYTES = 1000000;

function createHandler({ runClaude }) {
  return (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');

    // Only the extension (or a tool with no browser origin, e.g. curl) may call
    // this. A real web page always sends its http(s) origin, so reject those —
    // otherwise any site you visit while the proxy runs could spend your quota.
    const origin = req.headers.origin;
    if (origin && !origin.startsWith('chrome-extension://')) {
      res.writeHead(403, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden origin.' }));
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Use POST.' }));
      return;
    }

    let body = '';
    let aborted = false;
    req.on('data', chunk => {
      if (aborted) return;
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        aborted = true;
        res.writeHead(413, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request too large.' }));
        req.destroy();
      }
    });
    req.on('end', async () => {
      if (aborted) return;
      let parsed;
      try {
        parsed = JSON.parse(body || '{}');
      } catch {
        parsed = {};
      }

      const { prompt, model } = parsed;
      if (!prompt || typeof prompt !== 'string') {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing "prompt".' }));
        return;
      }

      try {
        const text = await runClaude(prompt, model || 'sonnet');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ text }));
      } catch (err) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  };
}

if (require.main === module) {
  const http = require('http');
  const PORT = process.env.PORT || 8787;
  const server = http.createServer(createHandler({ runClaude }));
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Claude proxy listening on http://127.0.0.1:${PORT}`);
  });
}

module.exports = { createHandler, runClaude };
