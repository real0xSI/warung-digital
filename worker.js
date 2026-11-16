// Warung Digital — Solo-Founder Store OS (Kiroween 2026, Frankenstein).
// Single Cloudflare Worker, zero npm dependencies. Mock checkout only:
// no real payment, no real money, no card data ever leaves the browser.
//
// State is module-level in-memory (documented deviation from the KV/Durable
// Objects idea in .kiro/specs/warung-digital/design.md). One isolate is
// single-threaded, so check-then-decrement inside createOrder is atomic.

const PRODUCTS = [
  { id: "claude-seat", name: "Claude Seat — 1 month", desc: "One shared Claude Max seat, invite delivered instantly.", price: 150000, stock: 5, delivery: "invite" },
  { id: "ebook-playbook", name: "Ebook: Solo Seller Playbook", desc: "How one seller runs a digital store from a phone. PDF + updates.", price: 49000, stock: null, delivery: "license" },
  { id: "lisensi-pos", name: "Software Licence: Warung POS Lite", desc: "Tiny point-of-sale for a small shop. One licence, one device.", price: 99000, stock: 20, delivery: "license" },
];

const RAILS = ["QRIS", "Stripe", "Cryptobot"];
const CRYPTO_ADDRESS = "TWarungDigitalMock9x7Q2m4K8vR1sT6uY3wE5aB";

export function createState() {
  return {
    products: PRODUCTS.map((p) => ({ ...p })),
    orders: [],
    nextOrder: 1,
    invitesUsed: 0,
  };
}

let state = createState();
export function resetState() { state = createState(); }

// Persistent state: Cloudflare KV when bound (deployed Worker), in-memory
// fallback when not (local tests). KV read-modify-write is sequential per
// request; concurrent same-millisecond orders could race — acceptable for a
// demo store, and disclosed in design.md.
async function loadState(env) {
  if (env && env.WD_STATE) {
    const raw = await env.WD_STATE.get("state");
    state = raw ? JSON.parse(raw) : createState();
  }
}

async function saveState(env) {
  if (env && env.WD_STATE) await env.WD_STATE.put("state", JSON.stringify(state));
}

function b64url(bytes) {
  let s = "";
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function unb64url(s) {
  s = s.replaceAll("-", "+").replaceAll("_", "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function issueLicense(secret, orderId, productId) {
  const payload = b64url(new TextEncoder().encode(`${orderId}|${productId}|${Date.now()}`));
  const sig = (await hmacHex(secret, payload)).slice(0, 16);
  return `WD1-${payload}.${sig}`;
}

export async function verifyLicense(secret, key) {
  try {
    if (!key || !key.startsWith("WD1-")) return { valid: false };
    const rest = key.slice(4);
    const dot = rest.lastIndexOf(".");
    if (dot < 0) return { valid: false };
    const payload = rest.slice(0, dot);
    const sig = rest.slice(dot + 1);
    const expect = (await hmacHex(secret, payload)).slice(0, 16);
    if (sig.length !== expect.length) return { valid: false };
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expect.charCodeAt(i);
    if (diff !== 0) return { valid: false };
    const [orderId, productId] = new TextDecoder().decode(unb64url(payload)).split("|");
    return { valid: true, orderId, productId };
  } catch {
    return { valid: false };
  }
}

async function nextInvite(secret) {
  const h = await hmacHex(secret, `seat-invite-${state.invitesUsed}`);
  state.invitesUsed += 1;
  return `WD-SEAT-${h.slice(0, 4).toUpperCase()}-${h.slice(4, 8).toUpperCase()}`;
}

function maskDelivery(d) {
  if (!d) return null;
  return "••••••••" + d.slice(-4);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function productView(p) {
  return { id: p.id, name: p.name, desc: p.desc, price: p.price, stock: p.stock, delivery: p.delivery };
}

function orderView(o, reveal) {
  return {
    id: o.id, productId: o.productId, productName: o.productName, buyer: o.buyer,
    rail: o.rail, amount: o.amount, createdAt: o.createdAt,
    delivery: reveal ? o.delivery : maskDelivery(o.delivery),
    deliveryRevealed: reveal,
    mockRef: o.mockRef,
  };
}

function mockRefFor(rail, orderId) {
  if (rail === "QRIS") return `WD-QRIS-${String(orderId).padStart(4, "0")}`;
  if (rail === "Stripe") return `WD-STRIPE-${String(orderId).padStart(4, "0")}`;
  return `WD-CRYPTO-${String(orderId).padStart(4, "0")}`;
}

function qrSvg(seed) {
  // Decorative MOCK QR-style pattern (not a real QR code), deterministic per seed.
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  let cells = "";
  const n = 12;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const corner = (x < 3 && y < 3) || (x >= n - 3 && y < 3) || (x < 3 && y >= n - 3);
      const on = corner ? (x % 3 === 0 || y % 3 === 0 || (x === 1 && y === 1)) : (((h >> ((x * 7 + y * 13) % 24)) & 1) === 1);
      if (on) cells += `<rect x="${x * 10}" y="${y * 10}" width="10" height="10"/>`;
    }
  }
  return `<svg width="120" height="120" viewBox="0 0 120 120" fill="#111" role="img" aria-label="Mock QR code">${cells}</svg>`;
}

function storefrontHtml() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Warung Digital — Solo-Founder Store in a Box</title>
<style>
:root{--bg:#1a0f2e;--card:#2a1845;--ink:#f5efe6;--mut:#c9b8e8;--acc:#ff7a1a;--acc2:#a855f7;--line:#4a2d73}
body.light{--bg:#fdf8ef;--card:#fff;--ink:#241a12;--mut:#6b5d52;--acc:#d35400;--acc2:#7b2fbe;--line:#e5d9c3}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,sans-serif;transition:background .3s}
header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--line)}
h1{margin:0;font-size:22px}h1 span{color:var(--acc)}
button{cursor:pointer;background:var(--acc);color:#fff;border:0;border-radius:8px;padding:10px 16px;font-weight:700}
button.ghost{background:transparent;border:1px solid var(--acc);color:var(--acc)}
main{max-width:760px;margin:0 auto;padding:20px}
.tag{display:inline-block;background:var(--acc2);color:#fff;border-radius:20px;padding:2px 10px;font-size:12px;margin-bottom:8px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:14px 0}
.price{font-size:20px;font-weight:800}.mut{color:var(--mut);font-size:14px}
.mock{border:1px dashed var(--acc);border-radius:8px;padding:10px;margin-top:10px;font-size:13px}
.mock b{color:var(--acc)}input,select{width:100%;padding:10px;border-radius:8px;border:1px solid var(--line);margin:6px 0;background:var(--bg);color:var(--ink)}
.delivery{background:#12351f;color:#b6f0c2;border-radius:8px;padding:12px;margin-top:10px;word-break:break-all}
footer{text-align:center;color:var(--mut);font-size:12px;padding:24px}
</style></head><body>
<header><h1>🎃 Warung <span>Digital</span></h1><button class="ghost" id="themeBtn" type="button">🌙 Costume: ON</button></header>
<main>
<span class="tag">KIROWEEN 2026 · FRANKENSTEIN · DEMO — MOCK CHECKOUT, NO REAL MONEY</span>
<p class="mut">One solo seller, one store, three products. Buy it, get the delivery instantly — license key, seat invite, or software licence. Built with Kiro CLI.</p>
<div id="products"></div>
<div id="checkout"></div>
</main>
<footer>Warung Digital · RichCommunity Studio · Built during Kiroween 2026 (30 Oct – 4 Dec 2026) with Kiro CLI · All payments are MOCK.</footer>
<script>
const $=s=>document.querySelector(s);
function theme(init){const t=localStorage.getItem('wd-theme')||'dark';document.body.classList.toggle('light',t==='light');$('#themeBtn').textContent=t==='light'?'☀️ Costume: OFF':'🌙 Costume: ON';}
$('#themeBtn').onclick=()=>{const t=document.body.classList.contains('light')?'dark':'light';localStorage.setItem('wd-theme',t);theme();};
theme();
let PRODUCTS=[];
async function load(){PRODUCTS=await(await fetch('/api/products')).json();$('#products').innerHTML=PRODUCTS.map(p=>
'<div class="card"><h3>'+p.name+'</h3><p class="mut">'+p.desc+'</p><p><span class="price">Rp '+p.price.toLocaleString('id-ID')+'</span> '+(p.stock===null?'<span class="mut">· unlimited stock</span>':'<span class="mut">· '+p.stock+' left</span>')+'</p><p class="mut">Delivery: '+(p.delivery==='invite'?'seat invite code':'HMAC license key')+'</p><button type="button" onclick="buy(\''+p.id+'\')">Buy — mock checkout</button></div>').join('');}
function railBox(rail,ref){if(rail==='QRIS')return '<div class="mock"><b>MOCK QRIS</b> — scan in the demo, then confirm below.<br><img src="/api/mockqr?seed='+ref+'" width="120" height="120" alt="Mock QR code"><br>Reference: <b>'+ref+'</b></div>';if(rail==='Stripe')return '<div class="mock"><b>MOCK STRIPE</b> — demo card form. Nothing is charged and card details never leave this page.<br><input placeholder="4242 4242 4242 4242 (demo only)" inputmode="numeric"><input placeholder="MM / YY"><input placeholder="CVC"></div>';return '<div class="mock"><b>MOCK CRYPTOBOT</b> — send demo USDT to:<br><code>TWarungDigitalMock9x7Q2m4K8vR1sT6uY3wE5aB</code><br>Auto-confirms after a 2-second demo delay.</div>';}
window.buy=function(id){const p=PRODUCTS.find(x=>x.id===id);$('#checkout').innerHTML='<div class="card"><h3>Checkout — '+p.name+'</h3><p><span class="price">Rp '+p.price.toLocaleString('id-ID')+'</span></p><label>Your name / email<input id="buyer" placeholder="e.g. Budi — budi@example.com"></label><label>Mock payment rail<select id="rail"><option>QRIS</option><option>Stripe</option><option>Cryptobot</option></select></label><div id="railbox"></div><p><button type="button" id="confirmBtn">Confirm mock order</button></p><div id="result"></div></div>';
const show=()=>{const r=$('#rail').value;$('#railbox').innerHTML=railBox(r,'WD-QRIS-…');};
$('#rail').onchange=show;show();
$('#confirmBtn').onclick=async()=>{const buyer=$('#buyer').value.trim()||'demo-buyer';const rail=$('#rail').value;$('#result').innerHTML='<p class="mut">Processing mock payment…</p>';if(rail==='Cryptobot')await new Promise(r=>setTimeout(r,2000));const res=await fetch('/api/order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({productId:id,buyer,rail})});const o=await res.json();if(!res.ok){$('#result').innerHTML='<p>❌ '+ (o.error||'Order failed') +'</p>';return;}$('#result').innerHTML='<div class="delivery">✅ Order #'+o.id+' confirmed ('+o.rail+', ref '+o.mockRef+').<br>Your delivery — shown ONCE, copy it now:<br><b>'+o.delivery+'</b></div><p class="mut">Re-opening this order later shows the delivery masked.</p>';load();};}
load();
</script></body></html>`;
}

function adminHtml(stats) {
  const rows = stats.orders.map((o) => `<tr><td>${o.id}</td><td>${o.productName}</td><td>${o.buyer}</td><td>${o.rail}</td><td>Rp ${o.amount.toLocaleString("id-ID")}</td><td>${o.createdAt}</td><td>${o.delivery === null ? "—" : "masked"}</td></tr>`).join("");
  const stock = stats.products.map((p) => `<li>${p.name}: ${p.stock === null ? "unlimited" : p.stock + " left"} — revenue Rp ${p.revenue.toLocaleString("id-ID")}</li>`).join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Warung Digital — Admin</title>
<style>body{font-family:system-ui,sans-serif;background:#1a0f2e;color:#f5efe6;margin:0;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #4a2d73;padding:8px;text-align:left}h1{color:#ff7a1a}</style></head>
<body><h1>🎃 Warung Digital — Admin</h1>
<p>Grand total revenue: <b>Rp ${stats.grandTotal.toLocaleString("id-ID")}</b> · Orders: <b>${stats.orders.length}</b></p>
<p style="color:#c9b8e8;font-size:13px">Note: orders are stored in Cloudflare KV (eventual consistency) — a fresh order can take up to ~60 s to appear here. The checkout confirmation itself is always authoritative.</p>
<h2>Stock &amp; revenue</h2><ul>${stock}</ul>
<h2>Orders</h2><table><tr><th>#</th><th>Product</th><th>Buyer</th><th>Rail</th><th>Amount</th><th>Time</th><th>Delivery</th></tr>${rows || '<tr><td colspan="7">No orders yet.</td></tr>'}</table>
<p><a href="/" style="color:#ff7a1a">← Back to store</a></p></body></html>`;
}

function getToken(request, url) {
  const h = request.headers.get("authorization") || "";
  if (h.startsWith("Bearer ")) return h.slice(7);
  return url.searchParams.get("token") || "";
}

async function handleOrder(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const product = state.products.find((p) => p.id === body.productId);
  if (!product) return json({ error: "Unknown product." }, 400);
  if (!body.buyer || typeof body.buyer !== "string") return json({ error: "Buyer name/email is required." }, 400);
  if (!RAILS.includes(body.rail)) return json({ error: "Rail must be QRIS, Stripe, or Cryptobot." }, 400);
  if (product.stock !== null && product.stock <= 0) return json({ error: "Out of stock." }, 409);
  // Atomic per isolate: check + decrement with no await in between.
  if (product.stock !== null) product.stock -= 1;
  const orderId = state.nextOrder++;
  const secret = env.HMAC_SECRET || "dev-only-fallback-secret";
  let delivery;
  if (product.delivery === "invite") delivery = await nextInvite(secret);
  else delivery = await issueLicense(secret, orderId, product.id);
  const order = {
    id: orderId, productId: product.id, productName: product.name,
    buyer: body.buyer.slice(0, 120), rail: body.rail, amount: product.price,
    createdAt: new Date().toISOString(), delivery,
    mockRef: mockRefFor(body.rail, orderId),
  };
  state.orders.push(order);
  await saveState(env);
  return json(orderView(order, true), 201);
}

function stats(env) {
  const products = state.products.map((p) => ({
    ...productView(p),
    revenue: state.orders.filter((o) => o.productId === p.id).reduce((s, o) => s + o.amount, 0),
  }));
  return {
    store: "Warung Digital", mode: "mock",
    products,
    orders: state.orders.map((o) => ({ ...orderView(o, false), delivery: null })),
    grandTotal: state.orders.reduce((s, o) => s + o.amount, 0),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (request.method === "GET" && path === "/") return new Response(storefrontHtml(), { headers: { "content-type": "text/html; charset=utf-8" } });
      if (request.method === "GET" && path === "/api/mockqr") {
        return new Response(qrSvg(url.searchParams.get("seed") || "WD-QRIS"), { headers: { "content-type": "image/svg+xml" } });
      }
      await loadState(env);
      if (request.method === "GET" && path === "/api/health") return json({ ok: true, store: "Warung Digital", mode: "mock", products: state.products.length, orders: state.orders.length });
      if (request.method === "GET" && path === "/api/products") return json(state.products.map(productView));
      if (request.method === "POST" && path === "/api/order") return await handleOrder(request, env);
      if (request.method === "GET" && path.startsWith("/api/order/")) {
        const id = Number(path.split("/")[3]);
        const o = state.orders.find((x) => x.id === id);
        if (!o) return json({ error: "Order not found." }, 404);
        return json(orderView(o, false));
      }
      if (request.method === "GET" && path === "/api/license/verify") {
        return json(await verifyLicense(env.HMAC_SECRET || "dev-only-fallback-secret", url.searchParams.get("key") || ""));
      }
      if (path === "/admin" || path === "/api/admin/stats") {
        if (!env.ADMIN_TOKEN) return new Response("Configuration error: ADMIN_TOKEN is not set.", { status: 500 });
        if (getToken(request, url) !== env.ADMIN_TOKEN) return new Response("Unauthorized.", { status: 401 });
        const s = stats(env);
        if (path === "/api/admin/stats") return json(s);
        return new Response(adminHtml(s), { headers: { "content-type": "text/html; charset=utf-8" } });
      }
      return json({ error: "Not found." }, 404);
    } catch (e) {
      return json({ error: "Server error.", detail: String(e && e.message ? e.message : e) }, 500);
    }
  },
};
