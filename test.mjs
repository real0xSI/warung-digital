// Warung Digital — test suite. Node 24 stdlib only: node --test test.mjs
// Tests call the real exported Worker fetch handler with synthetic Requests.
import test from "node:test";
import assert from "node:assert/strict";
import worker, { resetState, issueLicense, verifyLicense } from "./worker.js";

const ENV = { ADMIN_TOKEN: "test-admin-token", HMAC_SECRET: "test-hmac-secret-2026" };
const NOADMIN = { HMAC_SECRET: "test-hmac-secret-2026" };

async function call(method, path, env = ENV, body) {
  const init = { method, headers: {} };
  if (body !== undefined) { init.headers["content-type"] = "application/json"; init.body = JSON.stringify(body); }
  const res = await worker.fetch(new Request(`https://warung.test${path}`, init), env, {});
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* HTML */ }
  return { res, text, data };
}

async function authed(method, path, env = ENV) {
  const res = await worker.fetch(new Request(`https://warung.test${path}`, { method, headers: { authorization: `Bearer ${env.ADMIN_TOKEN}` } }), env, {});
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* HTML */ }
  return { res, text, data };
}

test("health reports ok, mock mode, 3 products", async () => {
  resetState();
  const { res, data } = await call("GET", "/api/health");
  assert.equal(res.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.mode, "mock");
  assert.equal(data.products, 3);
});

test("storefront HTML lists 3 products, theme toggle, MOCK labels", async () => {
  const { res, text } = await call("GET", "/");
  assert.equal(res.status, 200);
  assert.match(text, /Costume/);
  assert.match(text, /MOCK CHECKOUT/);
  assert.match(text, /themeBtn/);
});

test("products list has fixture prices and stock", async () => {
  const { data } = await call("GET", "/api/products");
  assert.equal(data.length, 3);
  const seat = data.find((p) => p.id === "claude-seat");
  assert.equal(seat.price, 150000);
  assert.equal(seat.stock, 5);
  assert.equal(data.find((p) => p.id === "ebook-playbook").stock, null);
});

test("ebook order via QRIS returns a verifiable license key, once", async () => {
  resetState();
  const { res, data } = await call("POST", "/api/order", ENV, { productId: "ebook-playbook", buyer: "budi@example.com", rail: "QRIS" });
  assert.equal(res.status, 201);
  assert.equal(data.rail, "QRIS");
  assert.match(data.mockRef, /^WD-QRIS-/);
  assert.match(data.delivery, /^WD1-/);
  const v = await verifyLicense(ENV.HMAC_SECRET, data.delivery);
  assert.equal(v.valid, true);
  assert.equal(v.productId, "ebook-playbook");
  // Re-read masks the delivery.
  const reread = await call("GET", `/api/order/${data.id}`);
  assert.equal(reread.data.deliveryRevealed, false);
  assert.match(reread.data.delivery, /•/);
  assert.doesNotMatch(reread.data.delivery, /WD1-/);
});

test("license verify endpoint: valid then tampered key fails", async () => {
  const key = await issueLicense(ENV.HMAC_SECRET, 99, "lisensi-pos");
  const ok = await call("GET", `/api/license/verify?key=${encodeURIComponent(key)}`);
  assert.equal(ok.data.valid, true);
  const bad = await call("GET", `/api/license/verify?key=${encodeURIComponent(key.slice(0, -1) + (key.slice(-1) === "0" ? "1" : "0"))}`);
  assert.equal(bad.data.valid, false);
  const junk = await call("GET", "/api/license/verify?key=garbage");
  assert.equal(junk.data.valid, false);
});

test("claude seat order returns invite code and decrements stock", async () => {
  resetState();
  const { data } = await call("POST", "/api/order", ENV, { productId: "claude-seat", buyer: "siti@example.com", rail: "Stripe" });
  assert.match(data.delivery, /^WD-SEAT-/);
  assert.equal(data.mockRef.startsWith("WD-STRIPE-"), true);
  const products = await call("GET", "/api/products");
  assert.equal(products.data.find((p) => p.id === "claude-seat").stock, 4);
});

test("seat stock exhausts at 5; 6th order is 409 and creates no order", async () => {
  resetState();
  for (let i = 0; i < 5; i++) {
    const r = await call("POST", "/api/order", ENV, { productId: "claude-seat", buyer: `buyer${i}@x.io`, rail: "Cryptobot" });
    assert.equal(r.res.status, 201, `seat ${i + 1} should succeed`);
    assert.match(r.data.mockRef, /^WD-CRYPTO-/);
  }
  const sixth = await call("POST", "/api/order", ENV, { productId: "claude-seat", buyer: "late@x.io", rail: "QRIS" });
  assert.equal(sixth.res.status, 409);
  assert.match(sixth.data.error, /Out of stock/);
  const { data } = await authed("GET", "/api/admin/stats");
  assert.equal(data.orders.length, 5);
});

test("order validation: unknown product, bad rail, missing buyer", async () => {
  resetState();
  assert.equal((await call("POST", "/api/order", ENV, { productId: "nope", buyer: "a@b.io", rail: "QRIS" })).res.status, 400);
  assert.equal((await call("POST", "/api/order", ENV, { productId: "ebook-playbook", buyer: "a@b.io", rail: "Cash" })).res.status, 400);
  assert.equal((await call("POST", "/api/order", ENV, { productId: "ebook-playbook", rail: "QRIS" })).res.status, 400);
});

test("unknown order id is 404; unknown route is 404", async () => {
  assert.equal((await call("GET", "/api/order/9999")).res.status, 404);
  assert.equal((await call("GET", "/nope")).res.status, 404);
});

test("admin without token is 401; wrong token is 401; right token is 200", async () => {
  resetState();
  assert.equal((await call("GET", "/admin")).res.status, 401);
  const wrong = await worker.fetch(new Request("https://warung.test/admin", { headers: { authorization: "Bearer wrong" } }), ENV, {});
  assert.equal(wrong.status, 401);
  const { res, text } = await authed("GET", "/admin");
  assert.equal(res.status, 200);
  assert.match(text, /Warung Digital — Admin/);
});

test("admin with no ADMIN_TOKEN configured is 500", async () => {
  assert.equal((await call("GET", "/admin", NOADMIN)).res.status, 500);
  assert.equal((await call("GET", "/api/admin/stats", NOADMIN)).res.status, 500);
});

test("admin stats: revenue math per product and grand total", async () => {
  resetState();
  await call("POST", "/api/order", ENV, { productId: "ebook-playbook", buyer: "a@b.io", rail: "QRIS" });
  await call("POST", "/api/order", ENV, { productId: "ebook-playbook", buyer: "c@d.io", rail: "Stripe" });
  await call("POST", "/api/order", ENV, { productId: "lisensi-pos", buyer: "e@f.io", rail: "Cryptobot" });
  const { data } = await authed("GET", "/api/admin/stats");
  assert.equal(data.grandTotal, 49000 + 49000 + 99000);
  assert.equal(data.products.find((p) => p.id === "ebook-playbook").revenue, 98000);
  assert.equal(data.orders.length, 3);
  assert.equal(data.orders[0].delivery, null, "admin list must not expose delivery artifacts");
});

test("mock QR endpoint returns SVG", async () => {
  const { res, text } = await call("GET", "/api/mockqr?seed=WD-QRIS-0001");
  assert.equal(res.status, 200);
  assert.match(text, /<svg/);
});

// ── Bug A: Buy button onclick must not produce unquoted id ──────────────────
test("Bug A: served storefront does not contain broken onclick buy(''+p.id+'')", async () => {
  const { text } = await call("GET", "/");
  // The broken pattern that JS string-concatenation produced
  assert.doesNotMatch(text, /buy\(''\+p\.id\+''\)/);
  // Must contain a valid way to identify the product — either data-product-id attribute
  // or a correctly-quoted onclick like buy('claude-seat')
  const hasDataAttr = /data-product-id=/.test(text);
  const hasQuotedOnclick = /buy\('claude-seat'\)/.test(text) || /buy\(&quot;claude-seat&quot;\)/.test(text);
  assert.ok(hasDataAttr || hasQuotedOnclick, "Buy button must pass product id via data-product-id or correctly quoted onclick");
});

// ── Bug B: Mock QR SVG must include xmlns ───────────────────────────────────
test("Bug B: /api/mockqr SVG contains xmlns=\"http://www.w3.org/2000/svg\"", async () => {
  const { res, text } = await call("GET", "/api/mockqr?seed=WD-QRIS-0001");
  assert.equal(res.status, 200);
  assert.match(text, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
});

// ── U1: License verify UI on storefront ─────────────────────────────────────
test("U1: storefront contains license verify box (input + button)", async () => {
  const { text } = await call("GET", "/");
  assert.match(text, /verify/i, "storefront must mention verify");
  assert.match(text, /verifyKey|verify-key|verifyInput|licenseInput|license-input|id="vkey"|id="licKey"/i, "must have an input for the key");
  assert.match(text, /api\/license\/verify/, "must call the verify endpoint");
});

// ── U2: My orders + order lookup + copy button ───────────────────────────────
test("U2: storefront contains my-orders container, order-lookup UI, and copy button", async () => {
  const { text } = await call("GET", "/");
  assert.match(text, /my.?orders|myOrders|my_orders/i, "must have my-orders section");
  assert.match(text, /find.?order|order.?lookup|lookupOrder/i, "must have order lookup UI");
  assert.match(text, /api\/order\//i, "must reference order lookup endpoint");
  assert.match(text, /copy|Copy/i, "must have a copy button");
  assert.match(text, /clipboard|writeText/i, "copy button must use clipboard API");
});

// ── U3: Public stats endpoint ────────────────────────────────────────────────
test("U3: /api/stats returns correct totals and no delivery/buyer fields", async () => {
  resetState();
  await call("POST", "/api/order", ENV, { productId: "ebook-playbook", buyer: "stats-user@x.io", rail: "QRIS" });
  await call("POST", "/api/order", ENV, { productId: "lisensi-pos", buyer: "another@x.io", rail: "Stripe" });
  const { res, data } = await call("GET", "/api/stats");
  assert.equal(res.status, 200);
  assert.equal(data.totalOrders, 2);
  assert.equal(data.grandTotal, 49000 + 99000);
  assert.ok(Array.isArray(data.seatsLeftByProduct), "seatsLeftByProduct must be an array");
  // Must not expose delivery artifacts or buyer names
  const raw = JSON.stringify(data);
  assert.doesNotMatch(raw, /WD1-/, "must not expose license keys");
  assert.doesNotMatch(raw, /WD-SEAT-/, "must not expose seat invite codes");
  assert.doesNotMatch(raw, /stats-user/, "must not expose buyer names");
  assert.doesNotMatch(raw, /another@x/, "must not expose buyer emails");
});

test("U3: storefront HTML contains the stats strip element", async () => {
  const { text } = await call("GET", "/");
  assert.match(text, /id="stats|stats-strip|statsStrip|id="statBar/i, "storefront must have a stats strip element");
});

// ── W1: WhatsApp order confirmation ─────────────────────────────────────────
test("W1: confirmation UI contains wa.me/?text= and encodeURIComponent", async () => {
  const { text } = await call("GET", "/");
  assert.match(text, /wa\.me\/\?text=/, "storefront script must construct a wa.me/?text= link");
  assert.match(text, /encodeURIComponent/, "must use encodeURIComponent for the WA message");
});

test("W1: WA share link contains order number and mockRef but NOT the delivery string", async () => {
  resetState();
  const { data } = await call("POST", "/api/order", ENV, {
    productId: "ebook-playbook", buyer: "budi@example.com", rail: "QRIS",
  });
  // The delivery artifact (license key begins WD1-)
  const deliveryStr = data.delivery; // e.g. WD1-…
  // The mockRef e.g. WD-QRIS-0001
  const mockRef = data.mockRef;
  const orderId = String(data.id);

  // The WA message template is a single line in the served storefront script.
  // Assert on THAT line only: it must build from order metadata (id, mockRef)
  // and must never reference the delivery artifact. (A wide char-slice here
  // would be brittle — it once forced user-facing words to be renamed just
  // to satisfy the test. The line scope is the real property.)
  const { text: html } = await call("GET", "/");
  const waLine = html.split("\n").find((l) => l.includes("waMsg="));
  assert.ok(waLine, "storefront script must build a waMsg");
  assert.match(waLine, /o\.id/, "WA message must include the order id");
  assert.match(waLine, /o\.mockRef/, "WA message must include the mock ref");
  assert.doesNotMatch(waLine, /delivery/i, "WA message must never reference the delivery artifact");
  assert.ok(!waLine.includes(deliveryStr), "WA message template must not contain the issued key");
  assert.ok(!waLine.includes(mockRef), "WA message template references the mockRef field, not a literal value");
  assert.ok(orderId.length > 0, "sanity: order id present");
});

// ── W2: Low-stock alert ───────────────────────────────────────────────────────
test("W2: after 3 claude-seat purchases stock is 2 and /api/products shows it", async () => {
  resetState();
  for (let i = 0; i < 3; i++) {
    const r = await call("POST", "/api/order", ENV, { productId: "claude-seat", buyer: `b${i}@x.io`, rail: "QRIS" });
    assert.equal(r.res.status, 201);
  }
  const { data } = await call("GET", "/api/products");
  const seat = data.find((p) => p.id === "claude-seat");
  assert.equal(seat.stock, 2, "stock must be 2 after 3 purchases");
});

test("W2: storefront script contains low-stock badge logic (<= 2)", async () => {
  const { text } = await call("GET", "/");
  // Must contain the threshold check
  assert.match(text, /<=\s*2/, "storefront must have stock <= 2 threshold check");
  // Must contain the badge text
  assert.match(text, /selling fast|Only.*left/i, "storefront must include low-stock badge text");
});

test("W2: admin stats HTML marks low-stock product with LOW flag after 3 seat purchases", async () => {
  resetState();
  for (let i = 0; i < 3; i++) {
    await call("POST", "/api/order", ENV, { productId: "claude-seat", buyer: `b${i}@x.io`, rail: "QRIS" });
  }
  const { text } = await authed("GET", "/admin");
  assert.match(text, /LOW/i, "admin HTML must show LOW flag for low-stock product");
});

// ── W3: Today's recap ────────────────────────────────────────────────────────
test("W3: /api/admin/stats includes today block with correct orders and revenue", async () => {
  resetState();
  await call("POST", "/api/order", ENV, { productId: "ebook-playbook", buyer: "a@b.io", rail: "QRIS" });
  await call("POST", "/api/order", ENV, { productId: "lisensi-pos", buyer: "c@d.io", rail: "Stripe" });
  const { data } = await authed("GET", "/api/admin/stats");
  assert.ok(data.today, "admin stats must include a 'today' block");
  assert.equal(typeof data.today.date, "string", "today.date must be a string");
  assert.match(data.today.date, /^\d{4}-\d{2}-\d{2}$/, "today.date must be YYYY-MM-DD");
  assert.equal(data.today.orders, 2, "today.orders must count orders placed today");
  assert.equal(data.today.revenue, 49000 + 99000, "today.revenue must sum orders placed today");
});

test("W3: /api/stats includes todayOrders count", async () => {
  resetState();
  await call("POST", "/api/order", ENV, { productId: "ebook-playbook", buyer: "a@b.io", rail: "QRIS" });
  const { data } = await call("GET", "/api/stats");
  assert.ok("todayOrders" in data, "/api/stats must include todayOrders");
  assert.equal(data.todayOrders, 1, "todayOrders must count today's orders");
});

test("W3: admin HTML contains today recap line", async () => {
  resetState();
  await call("POST", "/api/order", ENV, { productId: "ebook-playbook", buyer: "a@b.io", rail: "QRIS" });
  const { text } = await authed("GET", "/admin");
  assert.match(text, /Today/i, "admin HTML must contain Today recap");
  assert.match(text, /orders/, "admin recap must mention orders");
});

test("W3: storefront stats strip contains Today: N orders", async () => {
  const { text } = await call("GET", "/");
  // The storefront script must have the Today: rendering branch
  assert.match(text, /Today[:\s]|todayOrders|today.*orders/i, "storefront script must render Today orders in stats strip");
});
