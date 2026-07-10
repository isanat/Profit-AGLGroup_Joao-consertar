---
name: InvestFlow deep import fix
description: Design subagents import from deep package paths that break Vite bundling
---

Design subagents frequently write deep-path imports like:
`import { setAuthTokenGetter } from "@workspace/api-client-react/src/custom-fetch"`

This breaks Vite because the package.json `exports` field only exposes `"."`.

**Why:** The subagent sees the file path and writes a direct import; Vite enforces package exports.

**How to apply:** After any design subagent run, grep `artifacts/investflow/src` for `@workspace/api-client-react/src/` and replace with the main package import `@workspace/api-client-react`. The main index.ts already re-exports everything needed including `setAuthTokenGetter`, `setBaseUrl`, and all generated hooks.
