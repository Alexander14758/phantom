import { Router } from "express";
import { fetchPortfolio } from "../lib/helius";
import { walletMonitor } from "../lib/walletMonitor";

const router = Router();

const ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * GET /wallet/:address
 * Returns the current portfolio for a Solana wallet address.
 * Prefers cached data from WalletMonitor (kept fresh by Helius WS).
 * Falls back to a direct Helius DAS API fetch if no cache exists.
 */
router.get("/wallet/:address", async (req, res) => {
  const { address } = req.params;

  if (!address || !ADDRESS_RE.test(address)) {
    return res.status(400).json({ error: "Invalid Solana wallet address" });
  }

  try {
    // Use cached portfolio from the real-time monitor (< 60 s old)
    const cached = walletMonitor.getPortfolio(address);
    if (cached && Date.now() - cached.fetchedAt < 60_000) {
      return res.json(cached);
    }

    // No cache or stale — fetch fresh from Helius DAS API
    const portfolio = await fetchPortfolio(address);
    return res.json(portfolio);
  } catch (err) {
    req.log.error({ err }, "Wallet fetch error");
    return res.status(500).json({ error: "Failed to fetch wallet data" });
  }
});

export default router;
