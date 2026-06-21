---
name: InvestFlow seed runner
description: How to run the seed.ts for InvestFlow without catalog/tsx issues
---

The `tsx` binary is not in the workspace root `.bin` but is available at:
`/home/runner/workspace/node_modules/.pnpm/node_modules/.bin/tsx`

Run seed from: `cd artifacts/api-server && /home/runner/workspace/node_modules/.pnpm/node_modules/.bin/tsx ./src/seed.ts`

**Why:** pnpm catalog doesn't have `@types/bcryptjs` or `tsx` entries; using direct version in devDependencies avoids catalog errors. The pnpm virtual store binary path is the reliable fallback.

**How to apply:** Any time a seed or one-off script needs tsx without a catalog entry, use this binary path directly.
