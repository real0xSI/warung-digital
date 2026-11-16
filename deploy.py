#!/usr/bin/env python3
"""Deploy Warung Digital to warung.richcommunity.dpdns.org (Cloudflare Workers).

Free path, no card: same API script-upload pattern as the cs-bot pilot
(verified 2026-11-14). Uploads worker.js as a module Worker with vars
ADMIN_TOKEN (demo token, published only in the Devpost judges-only field)
and HMAC_SECRET (fresh random hex per deploy; never printed or logged —
redeploying rotates it, so license keys from an older deploy stop verifying).

Usage:
  python3 deploy.py deploy
  python3 deploy.py delete

Auth: same surrogate flow as cf.py (custom.cloudflare credential,
api.cloudflare.com only). No secret is ever written to a file, log, or argument.
"""
import json
import secrets
import sys
import urllib.error
import urllib.request

sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request

ACCOUNT_ID = "75a33bea37122d4f45cdbc79cc5f76f9"
ZONE_ID = "d812b932d8f1fa4c70c4c20899279c39"
WORKER_NAME = "warung-digital"
KV_NAMESPACE_ID = "18826a3d71354526a4621d2429d17b99"  # warung-digital-state (created 2026-11-16 via API)
SUBDOMAIN = "warung.richcommunity.dpdns.org"
ADMIN_TOKEN = "wd-admin-demo-2026"  # demo token; judges-only field on Devpost
BASE = "https://api.cloudflare.com/client/v4"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def call(method, path, body=None, content_type="application/json"):
    data = None
    if body is not None:
        data = body if isinstance(body, (bytes, str)) else json.dumps(body)
        if isinstance(data, str):
            data = data.encode()
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", content_type)
    add_surrogate_to_request(req, "custom.cloudflare", allowed_hosts=["api.cloudflare.com"])
    opener = urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(req, timeout=60) as r:
            raw = r.read().decode()
            try:
                return r.status, json.loads(raw)
            except json.JSONDecodeError:
                return r.status, {"raw": raw[:500]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"raw": raw[:500]}


def build_multipart(js):
    boundary = "----warung" + secrets.token_hex(8)
    metadata = json.dumps({
        "main_module": "worker.js",
        "compatibility_date": "2026-11-16",
        # Plain-text `vars` in metadata did NOT take effect on the live Worker
        # (admin returned 500 after the first deploy), so secrets are set via
        # the /secrets endpoint below instead. KV binding DOES work here.
        "bindings": [{"type": "kv_namespace", "name": "WD_STATE", "namespace_id": KV_NAMESPACE_ID}],
    })
    parts = []
    parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"metadata\"\r\nContent-Type: application/json\r\n\r\n{metadata}\r\n".encode())
    parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"worker.js\"; filename=\"worker.js\"\r\nContent-Type: application/javascript+module\r\n\r\n".encode() + js.encode() + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def deploy():
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "worker.js"), encoding="utf-8") as f:
        js = f.read()
    hmac_secret = secrets.token_hex(32)  # fresh per deploy; never printed
    body, ctype = build_multipart(js)
    print(f"uploading worker {WORKER_NAME} ({len(js)} bytes js, multipart with KV binding)...")
    s, d = call("PUT", f"/accounts/{ACCOUNT_ID}/workers/scripts/{WORKER_NAME}", body=body, content_type=ctype)
    print("upload:", s, json.dumps(d)[:300])
    if s not in (200, 201):
        return 1
    # Secrets via the dedicated endpoint (metadata `vars` did not take effect).
    s, d = call("PUT", f"/accounts/{ACCOUNT_ID}/workers/scripts/{WORKER_NAME}/secrets", body={"name": "ADMIN_TOKEN", "text": ADMIN_TOKEN, "type": "secret_text"})
    print("secret ADMIN_TOKEN:", s, json.dumps(d)[:200])
    if s not in (200, 201):
        return 1
    s, d = call("PUT", f"/accounts/{ACCOUNT_ID}/workers/scripts/{WORKER_NAME}/secrets", body={"name": "HMAC_SECRET", "text": hmac_secret, "type": "secret_text"})
    print("secret HMAC_SECRET: set (value not shown)")
    if s not in (200, 201):
        return 1
    short = SUBDOMAIN.split(".")[0]
    s, d = call("POST", f"/zones/{ZONE_ID}/dns_records", body={
        "type": "A", "name": short, "content": "192.0.2.1", "proxied": True, "ttl": 1,
    })
    print("dns:", s, json.dumps(d)[:300])
    if s not in (200, 201):
        s2, d2 = call("GET", f"/zones/{ZONE_ID}/dns_records?type=A&name={SUBDOMAIN}")
        print("dns lookup:", s2, json.dumps(d2)[:300])
        if s2 != 200 or not d2.get("result"):
            return 1
    s, d = call("POST", f"/zones/{ZONE_ID}/workers/routes", body={
        "pattern": f"{SUBDOMAIN}/*", "script": WORKER_NAME,
    })
    print("route:", s, json.dumps(d)[:300])
    if s not in (200, 201):
        s2, d2 = call("GET", f"/zones/{ZONE_ID}/workers/routes")
        ok = any(r.get("pattern") == f"{SUBDOMAIN}/*" for r in (d2.get("result") or []))
        print("route lookup, already exists:", ok)
        if not ok:
            return 1
    print(f"DEPLOYED https://{SUBDOMAIN}/")
    print("NOTE: HMAC_SECRET was generated fresh for this deploy and not stored.")
    print("License keys issued before this deploy will NOT verify after it.")
    return 0


def delete():
    s, d = call("DELETE", f"/accounts/{ACCOUNT_ID}/workers/scripts/{WORKER_NAME}")
    print("delete worker:", s, json.dumps(d)[:300])
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: deploy.py deploy|delete")
        sys.exit(2)
    sys.exit(deploy() if sys.argv[1] == "deploy" else delete())
