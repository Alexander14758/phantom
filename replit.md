# Phantom Wallet

A Phantom-style crypto wallet app with live Solana wallet data, real-time price tracking, and a WebSocket-powered transaction feed.

## Run & Operate

- **API Server** — workflow `API Server` runs `PORT=8080 pnpm --filter @workspace/api-server run dev` (port 8080)
- **Web Wallet** — workflow `Wallet Web` runs `PORT=5173 pnpm --filter @workspace/wallet-web run dev` (port 5173)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (runtime-managed by Replit, no manual setup needed)
- Optional env: `HELIUS_API_KEY` — live Solana wallet data (free at helius.dev)
- Optional env: `COINGECKO_API_KEY` — live crypto prices (free at coingecko.com/en/api)
- `SESSION_SECRET` — already configured as a Replit Secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
