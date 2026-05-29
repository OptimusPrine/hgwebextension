# Buyer-Question Map

A Chrome extension that captures buyer questions from Reddit, Google, G2, Capterra,
and YouTube and synthesizes them into a journey-stage map.

## AI providers

The extension needs a model to extract and synthesize questions. Pick one in
**Settings → AI Provider**:

| Provider   | Auth                          | Cost                          |
| ---------- | ----------------------------- | ----------------------------- |
| **Claude** | Anthropic API key             | Pay-per-call (API billing)    |
| **OpenAI** | OpenAI API key                | Pay-per-call (API billing)    |
| **Local**  | Your existing `claude` login  | Uses your Claude subscription |

## Using the "Local" provider (Claude subscription, no API key)

The **Local** provider routes AI calls through a small proxy that shells out to your
logged-in [Claude Code](https://docs.claude.com/en/docs/claude-code) CLI. Calls run
under your Claude subscription (e.g. Max) instead of a paid API key. See
[`proxy/README.md`](proxy/README.md) for proxy internals.

### One-time setup

1. **Log in to Claude Code** (if you haven't): run `claude` once and complete sign-in.
2. **Load the extension:** open `chrome://extensions`, enable **Developer mode**,
   click **Load unpacked**, and select this folder.
3. **Select the provider:** open the side panel → **Settings** → set **AI Provider**
   to **Local** → **Save**. Leave **Local Proxy URL** blank to use the default
   (`http://127.0.0.1:8787/v1/messages`).

### Each session

1. **Start the proxy** and leave it running:
   ```bash
   node proxy/server.js
   # → Claude proxy listening on http://127.0.0.1:8787
   ```
   (Override the port with `PORT=9000 node proxy/server.js`, and set the matching
   URL in Settings.)
2. **Use the extension normally** — **Capture** extracts questions from the current
   page; **Synthesize** builds the map. Each action is one AI call routed through
   your subscription.
3. **Stop the proxy** (Ctrl-C) when you're done.

### Choosing models

In **Settings → Local Models**, pick the model used for **Extract** and **Synthesize**
independently (`haiku` / `sonnet` / `opus`). Defaults are `haiku` for extract and
`sonnet` for synthesize. No proxy restart needed — the choice is sent per request.

### Editing prompts

**Settings → Prompt Templates** lets you view and edit any prompt the extension
sends (synthesize, suggest, blog, and the per-source extractors). Pick one from the
dropdown, edit the text, and **Save Settings**. Keep the `{{...}}` placeholders
(e.g. `{{QUESTIONS}}`, `{{ICP}}`) — they're filled in at runtime; deleting one just
omits that data. **Reset this prompt to default** restores the original. Edits are
stored per-user and apply to every provider, not just Local.

### Notes

- Expect **~3s extra per call** (the CLI cold-starts each time). During synthesize
  the panel shows an elapsed-time counter so you can see it's still working.
- The proxy request timeout defaults to **5 minutes**; override with
  `CLAUDE_TIMEOUT_MS=600000 node proxy/server.js`. Chrome's extension service worker
  has its own ~5-minute ceiling, so extremely long runs may still be cut off.
- If the proxy isn't running, the extension shows
  *"Local proxy not reachable. Start it with: node proxy/server.js"*.
- The proxy binds to `127.0.0.1` and only accepts calls from the extension (it
  rejects ordinary web-page origins).
- **WSL users:** the proxy listens inside WSL. A Windows-side Chrome reaches it via
  WSL2's `localhost` forwarding; if it can't connect, that forwarding is the first
  thing to check.

## Development

```bash
npm install   # install dev dependencies (jest)
npm test      # run the full test suite
```
