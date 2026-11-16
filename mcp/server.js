// Warung Digital — MCP server (stdio, no dependencies).
// Exposes store operations to Kiro via the MCP protocol. Tools call the real
// worker.js fetch handler with synthetic Requests, so there is no duplicated
// store logic. NOTE: runs in its own process with its own in-memory state —
// a dev-time tool, not the deployed store.
import worker, { resetState } from "../worker.js";

const ENV = {
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || "demo-admin-2026",
  HMAC_SECRET: process.env.HMAC_SECRET || "local-dev-only-do-not-use-in-production",
};

const TOOLS = [
  { name: "list_products", description: "List the 3 Warung Digital products with price and stock.", inputSchema: { type: "object", properties: {} } },
  { name: "create_order", description: "Create a mock-checkout order. Rails: QRIS, Stripe, Cryptobot. Mock only, no real money.", inputSchema: { type: "object", properties: { productId: { type: "string" }, buyer: { type: "string" }, rail: { type: "string" } }, required: ["productId", "buyer", "rail"] } },
  { name: "verify_license", description: "Verify an HMAC-signed Warung Digital license key.", inputSchema: { type: "object", properties: { key: { type: "string" } }, required: ["key"] } },
  { name: "store_stats", description: "Orders, stock and revenue (admin view, JSON).", inputSchema: { type: "object", properties: {} } },
];

async function callWorker(method, path, body) {
  const init = { method, headers: { authorization: `Bearer ${ENV.ADMIN_TOKEN}` } };
  if (body !== undefined) { init.headers["content-type"] = "application/json"; init.body = JSON.stringify(body); }
  const res = await worker.fetch(new Request(`https://warung.test${path}`, init), ENV, {});
  return { status: res.status, data: JSON.parse(await res.text()) };
}

async function runTool(name, args) {
  if (name === "list_products") return (await callWorker("GET", "/api/products")).data;
  if (name === "create_order") {
    const r = await callWorker("POST", "/api/order", args);
    if (r.status >= 400) throw new Error(r.data.error || "order failed");
    return r.data;
  }
  if (name === "verify_license") return (await callWorker("GET", `/api/license/verify?key=${encodeURIComponent(args.key)}`)).data;
  if (name === "store_stats") return (await callWorker("GET", "/api/admin/stats")).data;
  throw new Error(`unknown tool ${name}`);
}

function send(obj) { process.stdout.write(JSON.stringify(obj) + "\n"); }

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", async (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    const id = msg.id ?? null;
    try {
      if (msg.method === "initialize") {
        send({ jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "warung-digital", version: "1.0.0" } } });
      } else if (msg.method === "notifications/initialized") {
        // no reply
      } else if (msg.method === "tools/list") {
        send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
      } else if (msg.method === "tools/call") {
        const out = await runTool(msg.params.name, msg.params.arguments || {});
        send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] } });
      } else {
        send({ jsonrpc: "2.0", id, error: { code: -32601, message: `method not found: ${msg.method}` } });
      }
    } catch (e) {
      send({ jsonrpc: "2.0", id, error: { code: -32000, message: String(e && e.message ? e.message : e) } });
    }
  }
});
