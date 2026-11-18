# How Kiro was used — Warung Digital (Kiroween 2026)

Honest write-up, written from the real build log (see BUILD_LOG.md). Nothing
here is claimed that did not happen.

## Surface used

**Kiro CLI 3.3.0**, non-interactive, on an Ubuntu VM, signed in with a free
**AWS Builder ID** (`praburizvan@gmail.com`, no card, no paid plan). Kiro IDE,
Web, and Crew were not used — the CLI is the surface that works headless, and
the rules accept IDE, CLI, Web and/or Crew.

## Real Kiro runs

1. **Spec generation (2026-11-16 ~07:04 UTC)** — one `kiro-cli chat` run
   (`--no-interactive --trust-all-tools --trust-workspace --effort low`,
   Auto model) wrote `.kiro/specs/warung-digital/requirements.md`: 20
   EARS-style requirements across Platform, Catalogue, Checkout, Payment
   Rails, Admin View, State Persistence, Halloween Theme, Security. The run
   created the spec directory and the file itself; exit 0. The effort flag was
   rejected (`model 'auto' offers no effort levels`) and the run proceeded on
   Auto — the cheapest model (1x multiplier).
2. **Everything else was written by the agent (Muse) with the Kiro layer as
   the working contract**: `design.md`, `tasks.md`, steering, hooks, agents,
   MCP server, skills, `worker.js`, `test.mjs`, `deploy.py`. Kiro's spec
   shaped the build — two spec requirements forced real design work:
   atomic stock decrement (req 6) and delivery-exactly-once (req 8/9).
3. **Masterpiece round (2026-11-17 ~21:21 EST)** — one `kiro-cli chat` run
   (`--no-interactive --trust-all-tools --trust-workspace`, Auto model),
   on the redeemed 4,000-credit Kiroween grant, fixed 2 live bugs the
   judges would have hit (dead Buy button from a template-literal
   escape-eating bug; mock QR SVG with no xmlns, unrenderable as an
   image) and added 3 upgrades test-first: a license-verify tool on the
   storefront, my-orders + order lookup + copy button, and a live public
   stats strip (`GET /api/stats`). Suite went 13/13 → 19/19, plus a
   12/12 real-browser (headless Chromium) smoke test of the full judge
   flow. The effort flag was rejected again (`model 'auto' offers no
   effort levels`) and the run proceeded on Auto.
4. **Warung-owner round (2026-11-17 ~21:30 EST)** — one `kiro-cli chat` run
   (`--no-interactive --trust-all-tools --trust-workspace`, Auto model),
   on the same grant, under the user's "masterpiece" bar (features must be
   genuinely useful for a real Indonesian warung owner, not just flashy):
   WhatsApp order confirmation (`wa.me/?text=`, key never in the message),
   low-stock alert (≤ 2 units left, storefront badge + admin `[LOW]`),
   and a "today's recap" for the seller (admin `today` block + public
   `todayOrders` on the stats strip). Suite went 19/19 → 28/28, plus a
   21/21 real-browser smoke test. The first launch of this run died in a
   runtime restart ~35 s in with no file changes; the re-run completed.

## Kiro layer shipped in the repo (all under `.kiro/`, committed)

- **Specs** — `specs/warung-digital/{requirements,design,tasks}.md`
  (spec-driven development: requirements first, then design, then tasks).
- **Steering** — `steering/{product,tech,structure}.md` (always-included
  foundation docs) + root `AGENTS.md`.
- **Hooks** — `hooks/on-save-test.json`: test-on-save + a pre-deploy gate
  (tests must pass before `deploy.py` runs).
- **Custom agents** — `agents/{store-ops,checkout-qa}.json` (CLI agent
  definitions with scoped tools and prompts).
- **MCP** — `settings/mcp.json` + `mcp/server.js`: a stdio MCP server with
  4 tools (`list_products`, `create_order`, `verify_license`, `store_stats`)
  that call the real Worker handler, so Kiro can operate the store. Verified
  live over stdio (initialize → tools/list → create_order).
- **Skills pack** — `skills/{license-key-delivery,mock-checkout-rails,
  store-admin-view}/SKILL.md` (open Agent Skills format, curated for this
  store).

## What Kiro was NOT

- No vibe-coding loop: the spec was written first and the code was built
  against it, with a 13-test suite gating every deploy.
- The 4,000-credit Kiroween grant was redeemed 2026-11-17 and powered the
  masterpiece round (run 3 above) — the first Kiro run on grant credits;
  runs 1–2 were on the free tier. Exact credit consumption of run 3 is
  not visible from the CLI or its local session store; the dashboard
  (app.kiro.dev/settings/account) is the source of truth.
- No property-based testing: the test suite is example-based
  (`node:test`, stdlib only). Stating this plainly because the rules list
  property-based testing as a Kiro power — it was not used here.

## Why this is "sufficient use of Kiro"

The project is incomprehensible without the `.kiro/` layer: the spec defined
the checkout contract, steering defined the stack rules, hooks gate deploys,
agents define the operator/QA roles, and the MCP server lets Kiro itself
drive the store. The write-up, the specs, and the committed `.kiro/`
directory are the evidence.
