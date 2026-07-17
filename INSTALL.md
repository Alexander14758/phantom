# Phantom Wallet — VS Code Installation Guide

This guide explains how to clone and run the full project locally in VS Code.

---

## Prerequisites

Install these tools before starting:

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | 20 LTS or higher | https://nodejs.org |
| **pnpm** | 9 or higher | `npm install -g pnpm` |
| **Git** | Latest | https://git-scm.com |
| **VS Code** | Latest | https://code.visualstudio.com |

---

## 1 — Clone the project

```bash
git clone <YOUR_REPLIT_GIT_URL>
cd <project-folder>
```

> **Tip:** Find your Git URL in Replit → ⋯ menu → Git → Clone URL.

---

## 2 — Install dependencies

Run this once from the project root:

```bash
pnpm install
```

pnpm reads the `pnpm-workspace.yaml` and installs packages for all artifacts at once.

---

## 3 — Set environment variables

Create a `.env` file at the root of the **api-server** artifact:

```bash
cp artifacts/api-server/.env.example artifacts/api-server/.env
```

Then open `artifacts/api-server/.env` and fill in your API keys:

```env
# Required for live Solana wallet data
HELIUS_API_KEY=your_helius_api_key_here

# Required for live crypto prices (BTC/ETH/SOL)
COINGECKO_API_KEY=your_coingecko_api_key_here

# Required for session security (any random 32-char string)
SESSION_SECRET=your_random_secret_here
```

> **Where to get keys:**
> - Helius: https://www.helius.dev (free tier available)
> - CoinGecko: https://www.coingecko.com/en/api (free tier available)
> - SESSION_SECRET: run `openssl rand -hex 32` in your terminal

---

## 4 — Run the API server

Open a terminal in VS Code and run:

```bash
pnpm --filter @workspace/api-server run dev
```

The API server starts on **http://localhost:8080**. Keep this terminal open.

---

## 5 — Run the React web wallet

Open a **second terminal** and run:

```bash
PORT=5173 BASE_PATH=/wallet-web/ pnpm --filter @workspace/wallet-web run dev
```

The web wallet opens at **http://localhost:5173/wallet-web/**

> **Note:** The web wallet talks to the API server at `http://localhost:8080/api/…`
> If the API server is on a different port, update `VITE_API_BASE` below.

---

## 6 — Run the mobile app (Expo) — optional

Open a **third terminal** and run:

```bash
pnpm --filter @workspace/phantom-wallet run dev
```

This starts the Expo Metro bundler. Scan the QR code with **Expo Go** on your phone, or press `w` to open in the browser.

---

## 7 — VS Code workspace setup (recommended)

Open the repo root in VS Code:

```bash
code .
```

**Recommended extensions** (VS Code will prompt you to install these):

- **ESLint** — `dbaeumer.vscode-eslint`
- **Prettier** — `esbenp.prettier-vscode`
- **TypeScript Nightly** — `ms-vscode.vscode-typescript-next`
- **Tailwind CSS IntelliSense** — `bradlc.vscode-tailwindcss`
- **React Native Tools** — `msjsdiag.vscode-react-native` (for Expo)
- **REST Client** — `humao.rest-client` (for testing API endpoints)

Save this as `.vscode/extensions.json` to auto-suggest them to teammates:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "msjsdiag.vscode-react-native"
  ]
}
```

---

## 8 — Run all services at once (optional)

Install `concurrently` globally:

```bash
npm install -g concurrently
```

Then run from the project root:

```bash
concurrently \
  "pnpm --filter @workspace/api-server run dev" \
  "PORT=5173 BASE_PATH=/wallet-web/ pnpm --filter @workspace/wallet-web run dev"
```

---

## Project structure

```
project/
├── artifacts/
│   ├── api-server/          ← Express API + WebSocket server
│   │   ├── src/
│   │   │   ├── app.ts       ← Express app setup
│   │   │   ├── index.ts     ← HTTP + WS server entry
│   │   │   ├── lib/
│   │   │   │   ├── helius.ts       ← Helius DAS wallet fetch
│   │   │   │   └── walletMonitor.ts ← Real-time WS monitor
│   │   │   └── routes/
│   │   │       ├── prices.ts       ← GET /api/prices
│   │   │       └── wallet.ts       ← GET /api/wallet/:address
│   │   └── public/          ← Legacy HTML wallet (still served at /api/)
│   │
│   ├── wallet-web/          ← React + Vite web wallet (NEW)
│   │   └── src/
│   │       ├── components/  ← BarSpinner, TokenRow, PullToRefresh, etc.
│   │       ├── hooks/       ← usePortfolio, useProfile
│   │       ├── lib/         ← colors, format, storage utils
│   │       └── pages/       ← WalletDashboard (main screen)
│   │
│   └── phantom-wallet/      ← Expo React Native mobile app
│       ├── app/(tabs)/      ← Main wallet screen
│       ├── components/      ← SwipeableRow, ProfileModal, etc.
│       └── hooks/           ← usePortfolio, useProfile
│
├── lib/
│   ├── api-spec/            ← OpenAPI spec (source of truth)
│   ├── api-client-react/    ← Generated React Query hooks
│   ├── api-zod/             ← Generated Zod validation schemas
│   └── db/                  ← Drizzle ORM database schema
│
└── pnpm-workspace.yaml      ← Monorepo workspace config
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `PORT environment variable is required` | Add `PORT=5173` before the dev command |
| `BASE_PATH environment variable is required` | Add `BASE_PATH=/wallet-web/` before the dev command |
| Prices show `—` | Check your `COINGECKO_API_KEY` in `.env` |
| Wallet doesn't connect | Check your `HELIUS_API_KEY`; free tier has rate limits |
| WebSocket keeps disconnecting | Normal on free Helius tier; REST polling fallback activates automatically |
| `pnpm install` fails | Make sure Node.js 20+ and pnpm 9+ are installed |
