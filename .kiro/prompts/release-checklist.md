# Release checklist (run before any deploy or submission edit)

1. `node --check worker.js` — parses.
2. `node --test test.mjs` — all tests pass, exit 0.
3. `python3 deploy.py deploy` — worker upload 200, DNS 200, route 200.
4. `curl https://warung.richcommunity.dpdns.org/api/health` — 200, `{"ok":true,...}`.
5. Live: buy one ebook (QRIS mock) — license key returned once, verifies at /api/license/verify.
6. Live: `/admin` without token → 401; with demo token → 200.
7. `git status` — no secrets, no `.env`, `.kiro` present and NOT in `.gitignore`.
8. Submission text discloses: pre-existing patterns reused (license-key HMAC pattern, deploy script pattern), all app code built in-period with Kiro CLI.
