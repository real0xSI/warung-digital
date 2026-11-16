# Warung Digital — Requirements

## Platform
1. WHEN the worker is deployed, it SHALL run as a single `worker.js` Cloudflare Worker with zero npm dependencies.
2. WHEN any module is needed, it SHALL be implemented inline using only the Cloudflare Workers runtime API and Web Crypto API.

## Catalogue
3. WHEN the store loads, it SHALL list exactly three products:
   - **Claude Seat** — Rp 150,000 · stock 5 · delivery: seat invite code
   - **Ebook** — Rp 49,000 · unlimited stock · delivery: HMAC-signed license key
   - **Software Licence** — Rp 99,000 · stock 20 · delivery: HMAC-signed license key
4. WHEN a product has a finite stock count, it SHALL display remaining units next to the product.

## Checkout
5. WHEN a buyer proceeds to checkout, it SHALL present three mock payment rails: QRIS, Stripe, and Cryptobot.
6. WHEN a buyer submits an order, it SHALL decrement finite stock atomically using a Durable Object or KV compare-and-swap before confirming the order.
7. WHEN stock reaches zero, it SHALL reject new orders for that product with an out-of-stock error without creating an order record.
8. WHEN an order is confirmed, it SHALL generate and display the delivery artifact exactly once on the confirmation page:
   - For the Claude Seat: return the next unused invite code from a pre-loaded list.
   - For the Ebook or Software Licence: return an HMAC-SHA-256-signed license key encoding `orderId|productId|timestamp`.
9. WHEN the confirmation page is revisited after first load, it SHALL show a masked placeholder instead of the delivery artifact.

## Payment Rails (Mock)
10. WHEN QRIS is selected, it SHALL display a static mock QR code image and an order reference number.
11. WHEN Stripe is selected, it SHALL display a mock card form (non-functional) and auto-confirm after submission.
12. WHEN Cryptobot is selected, it SHALL display a mock crypto address and auto-confirm after a 2-second delay.

## Admin View
13. WHEN a request arrives at `/admin` with a valid `Authorization: Bearer <ADMIN_TOKEN>` header, it SHALL render an HTML page listing all orders, current stock levels, and total revenue per product.
14. WHEN a request arrives at `/admin` without a valid token, it SHALL respond with HTTP 401.

## State Persistence
15. WHEN any order mutation occurs, it SHALL persist order records and stock counters in Cloudflare KV.
16. WHEN the worker is redeployed, it SHALL retain all existing orders and stock state from KV.

## Halloween Theme
17. WHEN the store page loads, it SHALL apply a default Halloween costume theme (dark background, orange and purple accents, spooky font).
18. WHEN a user clicks the theme toggle, it SHALL switch between the Halloween costume theme and a plain light theme, persisting the choice in `localStorage`.

## Security
19. WHEN generating a license key, it SHALL use a secret `HMAC_SECRET` environment variable as the HMAC key; the key SHALL NOT be embedded in source code.
20. WHEN the `ADMIN_TOKEN` environment variable is absent, it SHALL refuse all `/admin` requests with HTTP 500 and a configuration-error message.
