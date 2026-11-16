# Demo video script — Warung Digital (< 3 min, public YouTube)

Target: **2 min 20 s**. Screen recording, no facecam. English voiceover or
captions. No copyrighted music, no third-party trademarks on screen. Film the
LIVE app at https://warung.richcommunity.dpdns.org/ (not localhost).

## Shots

| Time | Shot | Voiceover / caption |
|---|---|---|
| 0:00–0:15 | Storefront loads. Halloween costume theme, 3 products, Rp prices. | "Warung Digital — a solo-founder store in a box, built with Kiro CLI for Kiroween 2026." |
| 0:15–0:45 | Buy the ebook, QRIS mock rail. Mock QR + reference `WD-QRIS-…` shown. Confirm. License key appears ONCE. | "Mock checkout — no real money. The license key is shown exactly once." |
| 0:45–1:15 | Buy the Claude seat, Cryptobot mock rail. Invite code `WD-SEAT-…` delivered. Stock 5 → 4. | "A seat invite, delivered instantly. Stock drops by one — no oversell." |
| 1:15–1:40 | Toggle costume theme off and on. Re-open order #1 — delivery is masked (`••••••••`). | "The costume theme never breaks checkout — and a re-opened order hides the delivery." |
| 1:40–2:05 | Admin view (token field blurred in edit). Orders, stock, revenue Rp 199,000. | "The seller's cockpit: orders, stock, revenue." |
| 2:05–2:20 | `GET /api/license/verify?key=…` → `{"valid":true}`. Same key with one character changed → `{"valid":false}`. End card: repo URL + "Built with Kiro CLI". | "Every key is HMAC-signed. Tamper with one character and it fails." |

## Filming notes

- The live store already holds demo orders (live-test orders from 2026-11-16).
  For a clean take, film the ebook + seat buys first, then admin — admin may
  lag up to ~60 s behind fresh orders (KV eventual consistency); if admin
  looks empty, wait 60 s and re-shoot that shot only.
- Blur the `Authorization` header value in the admin shot (demo token, but
  keep the video clean).
- Keep the whole video under 3:00 — judges are not required to watch past it.
