# Mock Checkout Rails (curated for Warung Digital)

Three mock payment rails. No real money, no card data, ever.

## Rails
- **QRIS**: show a mock QR (inline SVG pattern, labelled MOCK) + order reference `WD-QRIS-<orderId>`. Buyer "pays" by confirming in the demo.
- **Stripe**: show a mock card form that is visual only — its submit handler never reads card fields into any request. Auto-confirms on submit.
- **Cryptobot**: show a mock USDT address + 2-second client-side delay, then auto-confirm.

## Rules
- Every mock surface carries a visible MOCK / DEMO label.
- The order is created server-side only after rail selection; stock decrements once, atomically, in `POST /api/order`.
- Never add a real payment SDK, key, or webhook to this project.
