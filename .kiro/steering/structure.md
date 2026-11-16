# Structure steering — Warung Digital

```
warung-digital/
├── worker.js                  # the whole app (storefront + API + admin)
├── test.mjs                   # node:test suite (stdlib only)
├── deploy.py                  # Cloudflare free-path deploy (API script upload)
├── mcp/server.js              # MCP server (stdio) wrapping worker.js
├── public/                    # (reserved; all HTML is inline in worker.js)
├── .kiro/
│   ├── specs/warung-digital/  # requirements.md, design.md, tasks.md
│   ├── steering/              # product.md, tech.md, structure.md
│   ├── hooks/                 # on-save test hook
│   ├── agents/                # store-ops, checkout-qa (CLI JSON)
│   ├── skills/                # curated SKILL.md pack (3 skills)
│   ├── prompts/               # demo-video, release-checklist
│   └── settings/mcp.json      # MCP server registration
├── README.md  LICENSE  AGENTS.md  .gitignore   # .gitignore MUST NOT list .kiro
├── BUILD_LOG.md  SUBMISSION.md  DEMO-VIDEO-SCRIPT.md  CHECKLIST.md  KIRO-USAGE.md
```

Rules:
- `worker.js` is the only runtime file. Keep it that way.
- Never add a dependency. If a feature needs a library, write the 30 lines.
- Never put `.kiro` in `.gitignore` — disqualification risk.
- Every behaviour change lands with a test in `test.mjs` first.
