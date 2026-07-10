# InvestFlow

Plataforma premium de gestão de investimentos onde usuários compram cotas de estratégias de trading e acompanham a performance de seu portfólio.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/investflow run dev` — run the frontend (port 20001)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Seed DB: `/home/runner/workspace/node_modules/.pnpm/node_modules/.bin/tsx artifacts/api-server/src/seed.ts` (run from project root)
- Required env: `DATABASE_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Wouter (routing) + TailwindCSS v4 + shadcn/ui
- Charts: Recharts
- Forms: react-hook-form + zod
- Animations: framer-motion
- Toasts: sonner
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: Custom JWT (bcryptjs + jsonwebtoken), tokens in localStorage
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/db/src/schema/` — DB schema files (users, strategies, positions, finances, platform)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, users, dashboard, strategies, positions, deposits, withdrawals, transactions, referrals, notifications, admin)
- `artifacts/api-server/src/middlewares/auth.ts` — JWT auth middleware
- `artifacts/api-server/src/lib/` — settings, audit, referral helpers
- `artifacts/api-server/src/seed.ts` — DB seed script
- `artifacts/investflow/src/pages/` — React page components
- `artifacts/investflow/src/components/` — Shared UI components
- `artifacts/investflow/src/lib/auth.tsx` — Auth context (JWT tokens in localStorage)
- `lib/api-client-react/src/` — Auto-generated API hooks + custom fetch

## Architecture decisions

- JWT stored in localStorage; injected into all API calls via `setAuthTokenGetter` from custom-fetch
- Access token: 15min, Refresh token: 30d — stored as `accessToken` / `refreshToken` keys
- Auth uses `SESSION_SECRET` env var as JWT secret
- Admin routes use `requireAdmin` middleware (checks role === "admin")
- Yield/rentabilidade application: admin applies % yield to a strategy → all active positions updated, balances credited, notifications sent
- Referral system: level-1 only by default (configurable via settings)
- All financial amounts stored as `numeric(20,8)` strings in DB, returned as numbers in API

## Product

- Users register/login, deposit funds (PIX, USDT, Bitcoin, USDC, BNB), buy cotas of investment strategies
- Dashboard shows balance, total invested, yield earned, recent activity
- Admin panel: full CRUD on strategies, confirm deposits, approve withdrawals, apply rentabilidade, broadcast notifications
- Referral program with commission tracking

## User preferences

- Dark theme always on — background #0B1120, cards #111827, emerald (#10B981) + gold (#F59E0B) accents
- Language: Portuguese (Brazilian market)
- No emojis in UI

## Gotchas

- Never `console.log` in server — use `req.log` in handlers, `logger` for non-request code
- Run codegen after changing OpenAPI spec: `pnpm --filter @workspace/api-spec run codegen`
- Run `pnpm --filter @workspace/db run push` after changing DB schema
- Strategy performance & position yield updates happen together in admin yield route
- The `tsx` binary for running seed: use `/home/runner/workspace/node_modules/.pnpm/node_modules/.bin/tsx`

## Login Credentials (seeded)

- **Admin**: `admin@investflow.com` / `Admin@123456`
- **Demo user**: `demo@investflow.com` / `Demo@123456`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
