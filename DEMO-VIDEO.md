# Warung Digital — Kiroween demo video

Built 2026-11-17 ~00:30 UTC. Output: `~/workspace/hackathons/kiroween-2026/demo.mp4`.

## Verdict

**DONE, verified.** Duration **140.043 s (2:20)**, 1920x1080, H.264 + AAC, 30 fps,
2,143,989 B. Under the 3:00 hard cap. Narration Kokoro male voice `am_adam`,
script voiceover lines verbatim. Cover is Halloween plum + orange/teal/amber/
magenta glows (never blue-black). End card: repo URL + "Built with Kiro CLI".
NOT uploaded to YouTube — parent handles upload. Devpost form and repo untouched.

## Segments (planned = actual, ffprobe-verified per segment)

| Seg | Time | Contents |
|-----|------|----------|
| s1 | 15 s | Cover card 5 s + storefront (3 products, Rp prices, costume ON) 10 s |
| s2 | 30 s | Ebook QRIS checkout form 9 s → mock QR (visible) 9 s → order #4 confirmed, license key shown once 12 s |
| s3 | 30 s | Seat Cryptobot form 10 s → order #5, invite WD-SEAT-2788-DF86 10 s → storefront, seat **3 left** (was 4) 10 s |
| s4 | 25 s | Costume OFF (light theme) 8 s → costume ON 7 s → re-opened order #1, delivery masked `••••••••408c` 10 s |
| s5 | 25 s | Admin cockpit: 5 orders, revenue **Rp 447.000**, seat 3 left, ebook Rp 147.000, seat Rp 300.000 |
| s6 | 15 s | License verify: valid → `{"valid":true,"orderId":"4"}`; one char changed → `{"valid":false}` 10 s → end card 5 s |

Audio: narration at each segment start (s1 7.0 s, s2 5.0 s, s3 5.1 s, s4 5.6 s,
s5 3.4 s, s6 4.9 s; 31 s total), silence padded to the planned segment length.
Volumedetect on the final file: mean −28.6 dB, max −2.4 dB. Every frame carries
a caption bar (script shot text). Stills from the final mp4 verified visually
at t=2, 10, 20, 28, 38, 50, 60, 70, 79, 95, 110, 130, 137.

## Filming data (live app, mock checkout)

- Ebook order **#4**, ref WD-QRIS-0004, key `WD1-NHxlYm9vay1wbGF5Ym9va3wxNzk0ODc0NTA4Mzcw.497730b62d97388b`
- Seat order **#5**, ref WD-CRYPTO-0005, invite `WD-SEAT-2788-DF86`
- Admin at capture time: 5 orders, grand total Rp 447.000, seat 3 left.
- Verify curls run live 2026-11-17 00:2x UTC and saved to `demo-video/work/verify-valid.json`
  and `work/verify-tampered.json`. The s6 terminal frame shows the verbatim
  responses; the key in the command line is abbreviated (`WD1-NHxl…388b`) for
  display. The s4 masked frame renders the verbatim `GET /api/order/1` JSON
  from `work/shots/data.json`.
- The admin shot contains NO Authorization header value anywhere on the page,
  so there was nothing to blur.

## Live bugs found while filming (NOT fixed on the deployment — redeploy blocked for this session)

1. **Storefront inline script broken in browsers.** The served HTML has
   `onclick="buy(''+p.id+'')"` — backslash escapes lost; the whole inline
   script fails to parse, no products render, no checkout works in a real
   browser. Filming workaround (in-browser only): `capture.py` extracts the
   page's own `<script>`, replaces `buy(''+p.id+'')` with
   `buy(\''+p.id+'\')`, re-injects it. Every network call still hit the LIVE API.
2. **Mock QR image broken.** `/api/mockqr` returns a valid SVG (3,280 B) but
   the `<svg>` root has no `xmlns`, so browsers show the XML tree / broken
   image (`naturalWidth: 0`); the pattern is also black-on-transparent,
   invisible on the dark card. Filming workaround (in-browser only):
   `reshoot_s2.py` fetches the live SVG, adds xmlns + a white background
   rect, sets it as a blob URL on the img. Pattern cells are exactly as the
   live API generated them. No order was placed by the re-shoot.

Both workarounds are in-browser filming repairs only; the deployment is
untouched. The parent must weigh the redeploy decision.

## Pipeline files

- `demo-video/capture.py` — Playwright capture of all 11 shots (local CONNECT
  relay `relay.py` on 127.0.0.1:18080 + `--ignore-certificate-errors` needed
  for Chromium egress; relay killed after use)
- `demo-video/reshoot_s2.py` — QR fix + s2 re-shoot
- `demo-video/gen_kokoro_warung.py` — Kokoro `am_adam` narration
  (`audio-kokoro/s1..s6.wav`, 24 kHz mono)
- `demo-video/build_video.py` — PIL frames + per-segment encode + concat
- `demo-video/work/shots/` — source screenshots + `data.json`
- `demo-video/work/stills/` — verification stills from the final mp4
- `demo-video/work/s1..s6.mp4` — per-segment intermediates

Rebuild: `python3 build_video.py` (re-runs narration only if WAVs missing —
`gen_kokoro_warung.py` first if needed; re-capture only if the live app state
changes).
