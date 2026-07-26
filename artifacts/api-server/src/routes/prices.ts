import { Router } from "express";

const router = Router();

router.get("/prices", async (req, res) => {
  try {
    const apiKey = process.env["COINGECKO_API_KEY"] ?? "";
    const url =
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana&order=market_cap_desc&price_change_percentage=24h";

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["x-cg-demo-api-key"] = apiKey;
    }

    const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });

    if (!response.ok) {
      req.log.error({ status: response.status }, "CoinGecko API error");
      return res.status(502).json({ error: "Failed to fetch prices from CoinGecko" });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "Price fetch error");
    return res.status(500).json({ error: "Internal error fetching prices" });
  }
});

export default router;
