# Submission package — Warung Digital (Kiroween 2026)

**Status: SUBMIT-READY except the user-side items at the bottom. Nothing has
been submitted — the user submits manually on Devpost.**

## Devpost fields (copy-paste ready)

- **Category:** Frankenstein
- **Bonus prizes:** Best Startup Project (+ Best Demo is automatic from the
  Presentation score; Social Blitz + Bonus Blog if the user posts them)
- **Project URL (working app):** https://warung.richcommunity.dpdns.org/
- **Code repo (public GitHub):** https://github.com/real0xSI/warung-digital
- **Demo video:** < 3 min, public YouTube — USER-SIDE, see below
- **Test credentials (judges-only field):** Admin — open
  `https://warung.richcommunity.dpdns.org/admin` with header
  `Authorization: Bearer wd-admin-demo-2026` (public demo credential; the
  demo store holds no real data). No login needed for the storefront.
- **Startup website (Best Startup):** https://jasa.richcommunity.dpdns.org/
  (RichCommunity Studio). Founder LinkedIn: USER-SIDE (user confirms/adds).

## Text description (for the Devpost form)

Warung Digital is a solo-founder digital store in a box. One Indonesian
seller working from a phone can list products, take orders on the three
payment rails buyers actually use — QRIS, Stripe, and crypto — and deliver
automatically: an HMAC-signed license key, a seat invite code, or a software
licence. An admin cockpit shows orders, live stock, and revenue. A Halloween
costume theme is the default and never breaks checkout.

It is a Frankenstein: six pieces that were never meant to live together — a
storefront catalogue, three mock payment rails, Web Crypto license signing, a
seat-invite dispenser, an admin view, and a costume theme — stitched into one
zero-dependency Cloudflare Worker, driven end to end by Kiro: specs,
steering, hooks, custom agents, an MCP server, and a skills pack, all
committed under `.kiro/`.

All checkout is MOCK — no real money moves. The demo store is free to test
until judging ends (29 Jan 2027).

## How Kiro was used

See `KIRO-USAGE.md` in the repo (full write-up). Short version: Kiro CLI
3.3.0 on the free tier wrote the requirements spec; the build followed the
spec with steering, hooks (test-on-save + pre-deploy gate), two custom agents,
a 4-tool MCP server, and a 3-skill pack — all committed under `.kiro/`.

## Reuse disclosure (required by the rules)

All app code (`worker.js`, `test.mjs`, `mcp/server.js`) and the `.kiro/` layer
were written fresh during the submission period with Kiro CLI. Two patterns
from the author's earlier work were reused and rewritten, not copied: the
HMAC license-key idea (reimplemented with Web Crypto, new key format) and the
Cloudflare free-path deploy script (`deploy.py`, adapted from an earlier
pilot). New-code share: ~78% of shipped code lines are new in-period (see
BUILD_LOG.md). No pre-existing app was submitted.

## Known limits (disclosed, not hidden)

- KV eventual consistency: a fresh order can take up to ~60 s to appear on
  re-read or in admin (verified live). The checkout confirmation itself is
  always authoritative.
- State is one KV JSON document; concurrent same-millisecond orders could
  race. Demo traffic is sequential.
- Mock checkout only: QRIS/Stripe/Cryptobot are all labelled MOCK.

## USER-SIDE (not done by the agent)

1. **Demo video:** record per `DEMO-VIDEO-SCRIPT.md` (< 3 min), upload to
   public YouTube from the phone, paste the link in the Devpost form.
2. **LinkedIn profile link** for Best Startup (confirm it exists / add it).
3. **Optional cheap bonuses:** social post starting with `#KiroweenHackathon26`
   + public blog post mentioning Kiroween 2026 (Bonus Blog).
4. **Submit on Devpost** before **Fri 4 Dec 2026 14:00 PT (Sat 5 Dec 05:00 WIB)**.
5. Keep the app live + free until judging ends (29 Jan 2027) — the agent
   maintains the deployment; do not delete the Worker.
