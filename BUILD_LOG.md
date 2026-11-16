# BUILD_LOG — Warung Digital (Kiroween 2026)

## Timeline (2026-11-16, EST)

- **02:03** Task received. Read `PLAN.md` + triage file; re-checked live rules
  at https://kiroween.devpost.com/rules — **matches, no conflicts**.
- **~02:05** Kiro CLI check: binary at `~/.local/bin/kiro-cli` (not on PATH),
  **v3.3.0, logged in as praburizvan@gmail.com (Builder ID)**.
- **~02:10** Real Kiro run: `kiro-cli chat` (Auto, `--no-interactive`,
  `--trust-all-tools --trust-workspace`) wrote
  `.kiro/specs/warung-digital/requirements.md` (20 EARS requirements, exit 0).
  Effort flag rejected (`model 'auto' offers no effort levels`) — proceeded on Auto.
- **~02:15–02:45** Built the app + `.kiro/` layer by hand against the spec:
  `worker.js`, `test.mjs`, `mcp/server.js`, steering, hooks, agents, skills,
  prompts, `AGENTS.md`.
- **~02:50** Tests: first run **10 pass / 3 fail** — 2 real bugs found:
  (1) delivery mask leaked the `WD1-` prefix (fixed: mask is now
  `••••••••` + last 4 chars); (2) test helper `authed()` dropped parsed JSON.
  Re-run: **13 pass / 0 fail**. MCP server verified live over stdio
  (initialize → tools/list → list_products → create_order).
- **~03:07** Deploy #1 (in-memory state): upload 200, DNS 200, route 200.
  Live checks found **2 real bugs**: (a) orders vanished between requests —
  each request can hit a fresh isolate (order id 1 issued twice, re-read 404);
  (b) `ADMIN_TOKEN`/`HMAC_SECRET` via multipart metadata `vars` did NOT take
  effect (admin → 500). Fixes: KV namespace `warung-digital-state` created
  via API (id `18826a3d71354526a4621d2429d17b99`, free), worker rewritten to
  load/save state from KV; secrets set via the `/secrets` endpoint.
- **~03:09** Deploy #2 (KV + secrets): upload 200. Live: admin 401 without
  token / 200 with token ✅; ebook order → verifiable key ✅; seat order →
  invite ✅; stock 5 → 4 ✅; health orders 2 ✅. One remaining effect: **KV
  eventual consistency** — immediate re-read 404'd and admin showed 0 orders,
  both correct after 65 s (masked delivery, 2 orders, Rp 199,000). Documented
  as a known limit (design.md, README, admin page note, SUBMISSION.md).
- **~03:15** Deploy #3 (admin KV-lag note): upload 200. Live URL re-verified.
- **~03:20** GitHub repo created via PAT API: **real0xSI/warung-digital**
  (public, 201). Files pushed via the Git Data API (no `git push` — the VM
  git remote path has no usable credential for github.com; the API path is
  the proven one). Main @ `bc6d1f62e6b964790a4ae861521ab9118f0e8aa3`, 28 files,
  `.kiro` present. MIT license detected by GitHub (`spdx_id: MIT`, verified
  via API — it showed `None` for a few minutes first, detection lag).
  Doc updates (CHECKLIST/tasks/BUILD_LOG) pushed after via Contents API.

## Test results

`node --test test.mjs` — **13/13 pass, exit 0** (Node 24.22.1, stdlib only):
health, storefront, catalogue, ebook order + verify + masking, license
verify valid/tampered/junk, seat invite + stock decrement, seat exhaustion
(5 ok → 6th 409, no order created), order validation (3×400), 404s, admin
401/401/200, admin 500 without token, revenue math, mock-QR SVG.

Live (https://warung.richcommunity.dpdns.org/): health 200, products 200,
storefront 200 (title + Costume toggle), ebook order 201 + key verifies +
masked on re-read (after KV propagation), seat order 201 + invite, stock
5→4 persisted, admin 401/200, tampered key invalid. Demo orders on the live
store: #1 ebook Rp 49,000 (Stripe), #2 Claude seat Rp 150,000 (QRIS).

## New-code share (honest)

| File | Lines | Origin |
|---|---|---|
| worker.js | 279 | new, in-period |
| test.mjs | 147 | new, in-period |
| mcp/server.js | 70 | new, in-period |
| deploy.py | 139 | ADAPTED from cs-bot pilot deploy.py (pre-existing pattern; multipart + KV + secrets are new) |
| .kiro/ layer + docs | ~900 | new, in-period (requirements.md written by Kiro CLI itself) |

Shipped code: **496 new / 635 total ≈ 78% new in-period**. The only reused
code is the deploy script; the HMAC license-key *idea* reimplements a prior
pattern in new code (Web Crypto, new key format). No pre-existing app code
was submitted. If the coordinator judges 78% thin, the plan's pivot
(Skeleton Crew, concept #2) is still available — I did NOT pivot on my own.

## Deploy (no card, $0)

- Worker `warung-digital` → https://warung.richcommunity.dpdns.org/
- KV namespace `warung-digital-state` (free tier)
- Secrets via API: `ADMIN_TOKEN` = `wd-admin-demo-2026` (public demo
  credential, documented in README), `HMAC_SECRET` = fresh random hex per
  deploy (never stored; redeploy rotates it and old keys stop verifying)
- First deploy failed once: module upload needs
  `Content-Type: application/javascript+module` (fixed in deploy.py).

## Known limits (disclosed)

1. KV reads can lag up to ~60 s (verified live). POST response is authoritative.
2. KV read-modify-write can race on same-millisecond concurrent orders.
3. Mock checkout only; no real payment rails.
4. No property-based testing (example-based suite only) — stated in KIRO-USAGE.md.
