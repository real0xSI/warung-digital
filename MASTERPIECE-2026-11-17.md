# Warung Digital — Masterpiece rounds (2026-11-17, Kiroween credits)

## Verdict

Both live bugs are fixed and 6 upgrades are built, all test-first, all verified
independently — **node suite 28/28** (was 13/13) and **real-browser smoke 21/21**
(headless Chromium, full judge flow). **NOT deployed** (blocked on the user's
decision, see below). **NOT pushed to GitHub** — the local dir is not a git
checkout; the public repo still serves the old code.

## Bug root causes (verified live before fixing)

**Bug A — dead Buy button (line 177).** The source had
`onclick="buy(\''+p.id+'\')"` inside the `storefrontHtml()` template literal.
The template literal eats one escape level, so the SERVED page contained
`onclick="buy(''+p.id+'')"` — verified by fetching `/` from the worker.
In the browser that concatenates to `onclick="buy(claude-seat)"` (unquoted id
→ ReferenceError on click). Fix: inline `onclick` dropped entirely; Buy
buttons use `data-product-id` + one delegated click listener. No escaping
pitfall can recur.

**Bug B — mock QR never renders (line ~138).** `qrSvg()` emitted `<svg>` with
no `xmlns`; browsers refuse to render such SVG as an `<img>` (verified:
`/api/mockqr` returned `image/svg+xml`, `naturalWidth 0` in a real browser).
Fix: `xmlns="http://www.w3.org/2000/svg"` on the `<svg>` tag. Smoke test now
shows `naturalWidth=120`.

## Round 1 — judge-facing upgrades (kiro-cli, Auto model, ~101 s)

- **U1 License verify UI** — "Verify a license key" box on the storefront
  (calls existing `GET /api/license/verify`, shows valid/invalid + product +
  order). Makes the Web Crypto HMAC story visible to judges.
- **U2 My orders + lookup + Copy** — order ids in `localStorage` ("My orders
  on this device"); "Find my order" box (`GET /api/order/:id`, masked
  delivery per req 9); real Copy button on the one-time delivery.
- **U3 Live public stats** — new public `GET /api/stats`
  (`totalOrders, grandTotal, seatsLeftByProduct`, no delivery/buyer data) +
  `#stats-strip` under the header.
- Tests 13/13 → 19/19. Real-browser smoke 12/12.

## Round 2 — warung-owner value, "masterpiece" bar (kiro-cli, Auto model)

User's bar: meaningful, aesthetic, solid, out of the box — useful for everyone
(like electricity). These three are things a real Indonesian warung owner
would use daily:

- **W1 WhatsApp order confirmation** — "Share via WhatsApp" button after
  checkout opens `https://wa.me/?text=<encoded>` (no phone number invented;
  buyer picks the seller contact). Message in Indonesian, only product name,
  price, order number, mock ref. **The delivery key/invite is NEVER in the
  message** (verified at runtime: decoded WA text contains order data, not
  the key). This is how Indonesian commerce actually closes a sale.
- **W2 Low-stock alert** — at ≤ 2 units left, the product card shows
  "Only X left — selling fast" and the admin stock list marks `[LOW]`.
- **W3 Today's recap** — admin stats gain `today: { date (UTC), orders,
  revenue }`, rendered on the admin page; public `/api/stats` gains
  `todayOrders`, shown in the strip as "· Today: N orders".
- Tests 19/19 → 28/28. Real-browser smoke 21/21 (re-ran all round-1 flows
  plus W1/W2/W3).

**Incident during round 2:** the first kiro-cli launch died in a runtime
restart ~35 s in — no file changes, no kiro process left, `/tmp` wiped
(prompt + smoke files). Re-created the prompt from the brief and re-ran;
the re-run completed in ~166 s.

**Verifier correction (not the agent's):** the agent's W1 test sliced 600 chars
after `wa.me` and asserted no `delivery` word — then renamed user-facing
words ("Your delivery" → "Your artifact", class `delivery` →
`artifact-box`, id `deliveryVal` → `deliverySpan`) just to satisfy that
brittle test. I replaced the test with a line-scoped assertion on the `waMsg`
construction line (must contain `o.id` + `o.mockRef`, must not reference
delivery) and restored the original clear wording. Suite still 28/28;
0 `artifact-box`/`deliverySpan` refs remain.

## deploy.py prep (done by hand, no deploy run)

New optional flags, default behaviour unchanged (fresh random secret, never
stored/printed):
- `deploy.py deploy --save-secret-to PATH` — writes the fresh secret to PATH
  (mode 0600) so a FUTURE deploy can reuse it.
- `deploy.py deploy --keep-secret-from PATH` — reuses the stored secret;
  keys issued under it keep verifying.
- Guards: mutually exclusive; paths inside the repo are refused (a secret
  file must never be committable); stored secret must be 64 lowercase hex.
- Helper tests: 6/6 pass (flag parsing, both-flags rejection, inside-repo
  rejection, unknown-flag rejection, write/read round-trip mode 0600,
  bad-secret rejection). `py_compile` OK. No network, no deploy executed.

## Credit usage

Not measurable from the CLI: `kiro-cli` has no usage/credits command and its
local session store (`~/.kiro/sessions/.../messages.jsonl`) carries no
token/credit fields. Dashboard is the source of truth:
https://app.kiro.dev/settings/account (was "kiroween2026 — 0 / 4000 used"
before the runs). Two kiro-cli runs (round 1 ~101 s, round 2 ~166 s, Auto
model, 1.00x multiplier) plus my own verification used the grant; exact
consumption needs a dashboard check. KIRO-USAGE.md updated (runs 3–4).

## THE REDEPLOY DECISION (needed from the user)

**Correction to the earlier framing:** the CURRENT live `HMAC_SECRET` is
unrecoverable — Cloudflare never reveals secret values via API. So **ANY
redeploy invalidates every license key/invite issued before it, including
the order #4 key shown in the demo video** — option (b) from the old dilemma
("preserve a known secret") is impossible for the CURRENT secret; the
`--keep-secret-from` flag only protects keys issued AFTER the next deploy.

- **Option A — redeploy now, accept rotation.** Store goes live fixed
  (working Buy buttons, visible QR, all 6 upgrades). Cost: every issued key
  fails verification; the demo video's license-verify shot must be re-shot
  with a fresh post-redeploy key (one shot only, ~minutes of filming).
  Recommended: run the redeploy with `--save-secret-to ~/.config/warung-hmac-secret`
  so this never happens again.
- **Option B — leave the live store as-is.** Judges see the broken store
  (dead Buy buttons, no products purchasable, broken QR image) — likely
  sinks the entry. Not recommended.
- **Option C — redeploy + re-shoot the one shot + re-upload video, then
  submit.** Same as A plus the video work. This is the full path to submit.

After his decision: one command (`python3 deploy.py deploy
--save-secret-to ~/.config/warung-hmac-secret`) → verify live → re-shoot
verify shot if needed → YouTube upload → Devpost submit (he clicks submit).

## Files changed

- `worker.js` (13.9 kB → 24.7 kB): Bug A + Bug B fixes; U1, U2, U3, W1, W2, W3.
- `test.mjs` (6.9 kB → 16.5 kB): 13 → 28 tests (6 round 1, 9 round 2).
- `deploy.py`: secret-persistence flags + docstring (default unchanged).
- `KIRO-USAGE.md`: runs 3–4 documented (grant-credit use, corrected).
- `MASTERPIECE-2026-11-17.md`: this file.
- NOT changed: `SUBMISSION.md`, `CHECKLIST.md`, `.gitignore` (no `.kiro`),
  `demo.mp4`, `demo-video/`, `.kiro/`, products/prices/stock fixture,
  `ADMIN_TOKEN`, HMAC handling. Zero npm deps added; no secrets in source.

## Test evidence (all run by the verifier, not just the agent)

- `node --test test.mjs`: **28/28 pass** (final run, after the W1-test correction).
- Real-browser smoke (headless Chromium via local server wrapping the worker):
  **21/21 pass** — 3 Buy buttons render; QR `naturalWidth=120`; ebook order →
  `WD1-` key; Copy → clipboard round-trip; WA text has order data, no key;
  My orders lists #1; verify valid + tampered rejection; lookup masked;
  seat order → `WD-SEAT-` invite; stats strip 2 orders / Rp 199.000 / 4 seats;
  after 3 seat buys "Only 2 left" badge; strip "Today: 4 orders"; admin
  `today` = 4 orders / Rp 499.000; public stats `todayOrders=4`, no leak;
  admin page `[LOW]` + Today recap line.
- Served-HTML checks: no `buy(''+p.id+'')`; `data-product-id` present;
  served inline script `node --check` clean; mockqr xmlns present.
- Smoke scripts were scratch in `/tmp` (wiped by the restart, recreated);
  they are not part of the repo.
