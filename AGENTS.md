# AGENTS.md — Warung Digital

Kiro reads this file on every run. Rules:

- Stack: Cloudflare Worker, one file `worker.js`, zero npm dependencies.
- Read `.kiro/specs/warung-digital/requirements.md` before changing behaviour.
- Read `.kiro/steering/*.md` for product, tech, and structure rules.
- Every behaviour change lands with a test in `test.mjs` first; run
  `node --test test.mjs` before claiming done.
- Never add a dependency, a real payment SDK, or a secret to source.
- Never put `.kiro` in `.gitignore`.
- Mock checkout only: QRIS / Stripe / Cryptobot are all labelled MOCK.
- Deploy only via `python3 deploy.py deploy` (free Cloudflare API path).
