# Tech steering — Warung Digital

- Runtime: Cloudflare Workers (V8 isolates). One module, `worker.js`.
- Zero npm dependencies. Only Workers runtime + Web Crypto APIs.
- Language: plain JavaScript (ES modules). No build step, no bundler.
- State: module-level in-memory maps (documented deviation from KV; see
  `.kiro/specs/warung-digital/design.md`). Single-threaded isolate ⇒
  check-then-decrement is atomic per isolate.
- Secrets: `HMAC_SECRET` (license signing) and `ADMIN_TOKEN` come from Worker
  vars set at deploy time. Never in source, never in logs.
- Tests: Node 24 stdlib `node:test`, `node --test test.mjs`. Tests call the
  real exported `fetch` handler with synthetic Requests.
- Deploy: free Cloudflare API script-upload path (`deploy.py`), no card, no
  wrangler login. Worker name `warung-digital`, route
  `warung.richcommunity.dpdns.org/*`.
