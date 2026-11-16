# Store Admin View (curated for Warung Digital)

The seller's cockpit: one page, orders + stock + revenue.

## Rules
- Route: `GET /admin` (HTML) and `GET /api/admin/stats` (JSON).
- Auth: `Authorization: Bearer <ADMIN_TOKEN>`. Missing/invalid token → 401.
  If `ADMIN_TOKEN` is not configured at all → 500 with a configuration error.
- The page lists every order (id, product, buyer, rail, amount, time), current
  stock per product, and total revenue per product + grand total.
- The demo admin token is published ONLY in the Devpost judges-only
  credentials field — never in the repo, never in a screenshot.
- Never expose license keys or invite codes in the admin list; show the
  delivery type and a masked key only.
