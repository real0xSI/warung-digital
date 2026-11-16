# Warung Digital — Design

## Architecture (single-file Worker, zero npm dependencies)

```
browser ──► Cloudflare Worker (worker.js, one module)
              ├─ GET  /                  storefront HTML (inline CSS/JS, no external assets)
              ├─ GET  /api/health        liveness + catalogue size
              ├─ GET  /api/products      catalogue (price, stock, delivery type)
              ├─ POST /api/order         mock checkout → stock decrement → delivery artifact
              ├─ GET  /api/order/:id     order summary, delivery MASKED after first reveal
              ├─ GET  /api/license/verify?key=…   HMAC verification
              ├─ GET  /admin             Bearer ADMIN_TOKEN → orders / stock / revenue
              └─ GET  /api/admin/stats   same auth, JSON
```

State lives in Cloudflare KV (`WD_STATE` binding, namespace
`warung-digital-state`, created free via the API) as one JSON document under
the key `state`. Every API request loads it, every mutation writes it back.
JavaScript on a single isolate is single-threaded, so the check-then-decrement
inside `createOrder` is atomic per isolate; KV read-modify-write can race
only if two orders land in the same millisecond on different isolates —
acceptable for a demo store, and the fallback when no KV is bound (local
tests) is module-level memory. An earlier in-memory-only build was deployed
and live-tested on 2026-11-16: orders vanished between requests because each
request can hit a fresh isolate — that failure is what forced the KV move,
and it is recorded in BUILD_LOG.md. KV reads are eventually consistent: a
fresh order can take up to ~60 s to appear on a re-read or in admin (verified
live 2026-11-16 — order #1 404'd on immediate re-read, then read fine with a
masked delivery after 65 s). The POST /api/order response is always
authoritative and is what the confirmation page shows. Strong-consistency
upgrade path: Durable Objects (single-writer) instead of KV.

## The Frankenstein stitch (six pieces, one app)

1. Storefront catalogue (3 fixture products, Rp prices).
2. Mock payment rails — QRIS (mock QR + reference), Stripe (mock card form,
   never transmits anything), @Cryptobot (mock USDT address, 2 s client delay).
3. HMAC-SHA-256 license keys (`WD1-<base64url(orderId|productId|ts)>.<hmac16>`)
   via Web Crypto, key from `HMAC_SECRET` env var — never in source.
4. Seat-invite delivery — pre-derived invite codes `WD-SEAT-XXXX`, one per
   Claude-seat order, dispensed in order.
5. Admin view — orders, live stock, revenue per product, Bearer-token gated.
6. Costume theme — Halloween dark/orange/purple by default, light theme on
   toggle, choice in `localStorage`.

## Delivery-exactly-once

`POST /api/order` returns the delivery artifact in the response body only.
`GET /api/order/:id` always masks it (`WD1-••••••••`). The confirmation page
renders the artifact from the POST response and never refetches it.

## Security notes

- No real payment, no real money, no card data leaves the browser — the Stripe
  form is visual only and its submit handler never reads card fields into a
  request. Every mock surface is labelled MOCK / DEMO.
- `ADMIN_TOKEN` absent → `/admin` and `/api/admin/stats` answer 500
  (requirement 20). The demo token is published only in the Devpost
  judges-only credentials field, never in the public repo.
- License keys verify offline via HMAC; tampering with any character fails
  verification (tested).

## Testing

`node --test test.mjs` (Node 24, stdlib only). Tests call the real exported
`fetch` handler with synthetic `Request` objects and an explicit `env`
(`ADMIN_TOKEN`, `HMAC_SECRET`), so they exercise routing, auth, stock,
licensing and masking end-to-end without a network round trip.
