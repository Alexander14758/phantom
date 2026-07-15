---
name: Helius real-time wallet architecture
description: How Helius DAS API + WebSocket powers the phantom-wallet real-time portfolio feed
---

## Architecture

**Backend (`artifacts/api-server`):**
- `src/lib/helius.ts` — Helius DAS `getAssetsByOwner` for all tokens with logos/prices in one call; CoinGecko fallback for known mints (MINT_TO_GECKO map) to get 24h price change
- `src/lib/walletMonitor.ts` — Singleton; opens one Helius enhanced WS (`wss://atlas-mainnet.helius-rpc.com`) per watched address using `transactionSubscribe`; re-fetches portfolio on tx notification (2 s debounce); broadcasts to app WS clients
- `src/index.ts` — HTTP server via `createServer(app)` + `WebSocketServer({ noServer: true })`; upgrades `/api/wallet-ws` connections

**Frontend (`artifacts/phantom-wallet`):**
- `hooks/usePortfolio.ts` — Native RN WebSocket to `wss://domain/api/wallet-ws`; sends `{ type: "subscribe", address }` on open; receives `{ type: "portfolio", data }` and `{ type: "transaction" }` messages; 30 s heartbeat ping; 3 s reconnect backoff; 30 s REST poll fallback when WS is down
- Live indicator: `wsStatus` field ("disconnected" | "connecting" | "connected" | "error") exposed from hook, renders pulsing dot in header when wallet is connected
- `pendingTx` flag set true on `transaction` message, cleared when `portfolio` arrives next

**Why:**
- Helius `transactionSubscribe` fires within ~1 s of confirmation — far faster than polling
- DAS `getAssetsByOwner` returns metadata + CDN logos in one RPC call vs Jupiter list + RPC combo
- Native RN WebSocket avoids SSE polyfill; proxy on Replit forwards WS upgrades fine

**How to apply:**
- Adding a new wallet starts monitoring automatically when `addClient` is called
- CoinGecko enrichment only runs for mints in MINT_TO_GECKO — extend that map for new known tokens
- The `ws` package is bundled by esbuild into `dist/index.mjs`
