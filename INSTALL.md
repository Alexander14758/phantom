# Running locally in VS Code

You need **Node.js 20+** installed. That's it.
Download it from https://nodejs.org if you don't have it.

---

## Step 1 — Get the code

Download or clone this project, then open the folder in VS Code.

---

## Step 2 — Run the API server

Open a terminal in VS Code and run:

```bash
cd artifacts/api-server
npm install
npm run dev
```

This starts the backend on **http://localhost:8080**.  
Keep this terminal open.

---

## Step 3 — Run the web wallet

Open a **second terminal** and run:

```bash
cd artifacts/wallet-web
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser.

Done ✓

---

## API keys (optional)

The app works without API keys — it will show a loading state for prices.  
For live crypto prices and real Solana wallet data, create a file at:

```
artifacts/api-server/.env
```

with this content:

```
HELIUS_API_KEY=your_key_here
COINGECKO_API_KEY=your_key_here
SESSION_SECRET=any_random_string_here
```

- Helius (free): https://www.helius.dev
- CoinGecko (free): https://www.coingecko.com/en/api

---

## Mobile app (optional)

```bash
cd artifacts/phantom-wallet
npm install
npm run dev
```

Scan the QR code with **Expo Go** on your phone, or press `w` to open in the browser.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm install` fails | Make sure you're inside the artifact folder, not the project root |
| Prices show `—` | Add `COINGECKO_API_KEY` to `artifacts/api-server/.env` |
| Port 5173 already in use | Run `PORT=3000 npm run dev` inside `artifacts/wallet-web` |
| Port 8080 already in use | Run `PORT=3001 npm run dev` inside `artifacts/api-server` |
