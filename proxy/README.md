# Local Claude proxy

Lets the extension run its AI calls through your **Claude Code login** (e.g. a
Max subscription) instead of a paid API key. It's a tiny HTTP server that shells
out to the `claude` CLI per request and returns the text.

## Prerequisites

- [Claude Code](https://docs.claude.com/en/docs/claude-code) installed and logged
  in with your subscription: run `claude` once and complete the sign-in.
- Node.js (already required for this repo).

## Run it

```bash
node proxy/server.js
# → Claude proxy listening on http://127.0.0.1:8787
```

Override the port with `PORT=9000 node proxy/server.js`.

Leave it running while you use the extension.

## Point the extension at it

In the extension's **Settings** pane, set **AI Provider** to **Local**. Leave the
**Local Proxy URL** blank to use the default (`http://127.0.0.1:8787/v1/messages`),
or set it if you changed the port. No API key is needed for this provider.

## How it works

Each request spawns:

```
claude -p --model <model> --tools "" --system-prompt <neutral> --output-format json
```

with the prompt piped to stdin. `--tools ""` and the neutral system prompt stop
Claude Code from behaving like a coding agent so it just transforms the text.
Models map to `haiku` (extract) and `sonnet` (synthesize).

## Notes & caveats

- **Loopback only.** The server binds to `127.0.0.1`, so it isn't reachable from
  other machines.
- **Personal-use gray area.** This drives a subscription meant for Anthropic's
  first-party Claude surfaces. Fine for personal/business use at your discretion;
  it isn't an explicitly blessed use case.
- **CORS is open (`*`).** Any page you visit while the proxy is running could POST
  to it and trigger a `claude` run. Stop the server when you're not using it, or
  add an `Origin` check if you want to harden it.
- **Latency.** Each call cold-starts the CLI (~3s + model time). Expected; not
  optimized.
