# Warung Digital — Solo-Founder Store in a Box

**Kiroween 2026 · Category: Frankenstein · Bonus: Best Startup**
**Live demo:** https://warung.richcommunity.dpdns.org/
**Built with:** Kiro CLI 3.3.0 (AWS Builder ID, free tier)

One Indonesian solo seller, working from a phone, runs a whole digital
business from this one app: three products, mock checkout on the three rails
buyers actually use (QRIS, Stripe, crypto), and instant delivery — an
HMAC-signed license key, a seat invite code, or a software licence — plus an
admin cockpit with orders, stock, and revenue. A Halloween costume theme is
the default; it never breaks checkout.

> **Demo only — mock checkout.** No real payment, no real money, no card data
> ever leaves the browser. The Stripe form is visual only. Every mock surface
> is labelled MOCK.

## Products (fixture prices, Rp)

| Product | Price | Stock | Delivery |
|---|---|---|---|
| Claude Seat — 1 month | Rp 150,000 | 5 | seat invite code |
| Ebook: Solo Seller Playbook | Rp 49,000 | unlimited | HMAC license key |
| Software Licence: Warung POS Lite | Rp 99,000 | 20 | HMAC license key |

## Try it

1. Open https://warung.richcommunity.dpdns.org/ (toggle the 🎃 Costume theme).
2. Buy the ebook with the QRIS mock rail — a license key appears **once**.
3. Re-open the order — the delivery is masked.
4. Verify the key: `GET /api/license/verify?key=<key>` → `{"valid":true,...}`.
   Tamper with one character → `{"valid":false}`.
5. Admin: `GET /admin` with `Authorization: Bearer wd-admin-demo-2026`
   (public demo credential — the demo store holds no real data).

## API

- `GET /api/health` — liveness
- `GET /api/products` — catalogue
- `POST /api/order` `{productId, buyer, rail}` — mock checkout, delivery returned once
- `GET /api/order/:id` — order summary, delivery masked
- `GET /api/license/verify?key=` — HMAC verification
- `GET /api/admin/stats` — Bearer-token JSON admin view

## Run it yourself

```bash
node --test test.mjs        # 13 tests, stdlib only, no network
python3 deploy.py deploy    # Cloudflare Workers, free API path, no card
```

One file runs the store: `worker.js` (zero npm dependencies). State lives in
Cloudflare KV (`WD_STATE`); secrets (`ADMIN_TOKEN`, `HMAC_SECRET`) are Worker
secrets set at deploy time. See `.kiro/specs/warung-digital/design.md` for the
architecture and the known KV propagation lag (~60 s on re-reads/admin).

## How Kiro was used

See [KIRO-USAGE.md](KIRO-USAGE.md) — specs, steering, hooks, custom agents,
MCP server, skills pack, and the real `kiro-cli chat` runs, all in
[`.kiro/`](.kiro/). The `.kiro/` directory is intentionally committed.

## Reuse disclosure (per Kiroween rules)

All app code in `worker.js`, `test.mjs`, `mcp/server.js` and the `.kiro/` layer
was written fresh during the submission period (30 Oct – 4 Dec 2026) with Kiro
CLI. Two *patterns* from the author's earlier work were reused and rewritten,
not copied: the HMAC license-key idea (reimplemented with Web Crypto and a new
key format) and the Cloudflare free-path deploy script (`deploy.py`, adapted
from an earlier pilot). See [BUILD_LOG.md](BUILD_LOG.md) for the line count.

## License

MIT — see [LICENSE](LICENSE).
