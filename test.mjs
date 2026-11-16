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
  const bad = await call("GET", `/api/license/verify?key=${encodeURIComponent(key.slice(0, -1) + "0")}`);
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
