# Running locally on Windows (VS Code)

You need **Node.js 20+** and **pnpm**. That's it — no Git Bash or Unix tools required.

---

## Step 1 — Install prerequisites

### Node.js 20+
Download from https://nodejs.org (pick the LTS version).  
Verify in any terminal:
```
node --version   # should say v20.x.x or higher
```

### pnpm
```
npm install -g pnpm
```

---

## Step 2 — Get the code

Download or clone this repository, then open the **root folder** in VS Code  
(the folder that contains `pnpm-workspace.yaml`).

---

## Step 3 — Install all dependencies

Open a terminal in VS Code (**Terminal → New Terminal**) and run once from the root:

```
pnpm install
```

This installs packages for every part of the project at once.  
PowerShell, CMD, and Git Bash all work.

---

## Step 4 — Add your API keys

Create a file at `artifacts/api-server/.env` with this content:

```
PORT=8080
HELIUS_API_KEY=01943427-43ba-446a-8d0c-b4ac29a4afb5
COINGECKO_API_KEY=CG-J1j1EoWrfB5uDKSsNyxnwMNW
SESSION_SECRET=any-random-string-here
```

> **PORT=8080 is required** — the server will throw an error without it.

---

## Step 5 — Start the API server

In a terminal (PowerShell, CMD, or Git Bash — all work):

```
cd artifacts/api-server
pnpm run dev
```

You should see:
```
Server listening  port: 8080
```

**Keep this terminal open.**

---

## Step 6 — Start the web app

Open a **second terminal** and run:

```
cd artifacts/wallet-web
pnpm run dev
```

You should see:
```
VITE ready in ...ms
➜  Local: http://localhost:5173/
```

Open **http://localhost:5173** in your browser. Done ✓

---

## Quick reference

| Service | Command | URL |
|---------|---------|-----|
| API backend | `cd artifacts/api-server && pnpm run dev` | http://localhost:8080 |
| React web app | `cd artifacts/wallet-web && pnpm run dev` | http://localhost:5173 |

Both must be running at the same time. The frontend automatically proxies `/api` requests to port 8080, so as long as both are up everything connects automatically.

---

## Optional: Mobile app (Expo)

```
cd artifacts/phantom-wallet
pnpm run dev:local
```

Scan the QR code with **Expo Go** on your phone, or press `w` to open in the browser.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `pnpm install` fails with "Use pnpm instead" | Make sure you're running `pnpm install`, not `npm install` |
| `PORT` error on start | Make sure `artifacts/api-server/.env` exists with `PORT=8080` |
| Prices show `—` | Check `COINGECKO_API_KEY` in `artifacts/api-server/.env` |
| Port 5173 already in use | Run `set PORT=3000 && pnpm run dev` (CMD) or `$env:PORT=3000; pnpm run dev` (PowerShell) inside `artifacts/wallet-web` |
| Port 8080 already in use | Change `PORT=8080` to `PORT=3001` in your `.env` file |
