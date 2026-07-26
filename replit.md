# Phantom Wallet

A Solana crypto wallet web app with real-time portfolio tracking, live crypto prices, and a mobile-first PWA experience.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Express (Node.js) + WebSocket |
| Solana data | Helius DAS API |
| Crypto prices | CoinGecko API |
| Mobile app | Expo (React Native) |

## Running on Replit

Two workflows run automatically:

- **`artifacts/api-server: API Server`** — Express backend on port 8080 (Helius + CoinGecko integration)
- **`artifacts/wallet-web: web`** — Vite dev server on port 20830, preview path `/wallet-web/`

## API Keys

Keys are hardcoded as fallbacks in:
- `artifacts/api-server/src/lib/helius.ts` — `HELIUS_API_KEY`
- `artifacts/api-server/src/lib/helius.ts` — `COINGECKO_API_KEY` (enrichment)
- `artifacts/api-server/src/routes/prices.ts` — `COINGECKO_API_KEY` (market prices)

Environment variables override the hardcoded values if set.

## Project Structure

```
artifacts/
  api-server/    # Express backend (port 8080)
  wallet-web/    # React/Vite frontend (port 20830)
  phantom-wallet/ # Expo mobile app (optional)
lib/
  api-spec/      # Shared API type definitions
  api-zod/       # Zod schemas
  api-client-react/ # React Query hooks
  db/            # Drizzle ORM schema
```

## User Preferences

- API keys should be hardcoded directly in source files (not hidden behind env vars).
- Mobile-first layout: web app is designed to fit phone screens, added to home screen as a PWA.
