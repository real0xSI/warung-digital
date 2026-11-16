# License-Key Delivery (curated for Warung Digital)

Issue HMAC-signed license keys and deliver a digital product exactly once.

## Rules
- Key format: `WD1-<base64url(orderId|productId|timestamp)>.<first-16-hex-of-HMAC-SHA256>`.
- Sign with Web Crypto (`crypto.subtle`), key = `HMAC_SECRET` env var. Never embed the secret in source.
- Verify by recomputing the HMAC over the payload and comparing in constant time (compare every byte, return one boolean).
- The delivery artifact is returned in the `POST /api/order` response ONLY. Any later read (`GET /api/order/:id`) masks it.
- A tampered key (any character changed) MUST fail verification — test this.

## When to use
Checkout for any product whose delivery type is `license` (ebook, software licence).
