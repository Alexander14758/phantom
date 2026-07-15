import { Router } from "express";

const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  logoURI?: string;
  decimals: number;
  extensions?: { coingeckoId?: string };
}

let tokenListCache: Map<string, JupiterToken> | null = null;
let tokenListCacheTime = 0;
const CACHE_TTL = 3_600_000; // 1 hour

async function getJupiterTokenList(): Promise<Map<string, JupiterToken>> {
  const now = Date.now();
  if (tokenListCache && now - tokenListCacheTime < CACHE_TTL) {
    return tokenListCache;
  }
  const response = await fetch("https://token.jup.ag/all", {
    signal: AbortSignal.timeout(12_000),
  });
  const tokens: JupiterToken[] = await response.json();
  const map = new Map<string, JupiterToken>();
  for (const token of tokens) {
    map.set(token.address, token);
  }
  tokenListCache = map;
  tokenListCacheTime = now;
  return map;
}

async function getTokenAccounts(address: string) {
  const results: unknown[] = [];
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    try {
      const response = await fetch(SOLANA_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountsByOwner",
          params: [
            address,
            { programId },
            { encoding: "jsonParsed", commitment: "confirmed" },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await response.json()) as { result?: { value?: unknown[] } };
      if (data.result?.value) results.push(...data.result.value);
    } catch {
      // Continue with the other program id
    }
  }
  return results as Array<{ account?: { data?: { parsed?: { info?: Record<string, unknown> } } } }>;
}

const router = Router();

router.get("/wallet/:address", async (req, res) => {
  const { address } = req.params;

  if (!address || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return res.status(400).json({ error: "Invalid Solana wallet address" });
  }

  try {
    const [accounts, tokenList] = await Promise.all([
      getTokenAccounts(address),
      getJupiterTokenList().catch(() => new Map<string, JupiterToken>()),
    ]);

    const tokens: Array<{
      mint: string;
      symbol: string;
      name: string;
      logo: string | null;
      amount: number;
      decimals: number;
      coingeckoId: string | null;
      usdValue: number | null;
      usdPrice: number | null;
      priceChange24h: number | null;
    }> = [];

    const geckoIds: string[] = [];

    for (const account of accounts) {
      const info = account?.account?.data?.parsed?.info;
      if (!info) continue;
      const mint = info["mint"] as string;
      const amount = info["tokenAmount"] ? (info["tokenAmount"] as Record<string, number>)["uiAmount"] : null;
      if (!amount || amount <= 0) continue;
      const decimals = info["tokenAmount"]
        ? (info["tokenAmount"] as Record<string, number>)["decimals"] ?? 0
        : 0;
      const meta = tokenList.get(mint);

      const token = {
        mint,
        symbol: meta?.symbol ?? mint.slice(0, 6).toUpperCase(),
        name: meta?.name ?? "Unknown Token",
        logo: meta?.logoURI ?? null,
        amount,
        decimals,
        coingeckoId: meta?.extensions?.coingeckoId ?? null,
        usdValue: null as number | null,
        usdPrice: null as number | null,
        priceChange24h: null as number | null,
      };

      tokens.push(token);
      if (token.coingeckoId) geckoIds.push(token.coingeckoId);
    }

    // Fetch prices for tokens mapped to CoinGecko
    if (geckoIds.length > 0) {
      try {
        const apiKey = process.env["COINGECKO_API_KEY"];
        const uniqueIds = [...new Set(geckoIds)].join(",");
        const headers: Record<string, string> = {};
        if (apiKey) headers["x-cg-demo-api-key"] = apiKey;
        const priceResp = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueIds}&vs_currencies=usd&include_24hr_change=true`,
          { headers, signal: AbortSignal.timeout(8_000) }
        );
        if (priceResp.ok) {
          const prices = (await priceResp.json()) as Record<string, { usd: number; usd_24h_change: number }>;
          for (const token of tokens) {
            if (token.coingeckoId && prices[token.coingeckoId]) {
              token.usdPrice = prices[token.coingeckoId].usd;
              token.usdValue = token.amount * token.usdPrice;
              token.priceChange24h = prices[token.coingeckoId].usd_24h_change;
            }
          }
        }
      } catch {
        // Prices unavailable — continue without them
      }
    }

    // Strip internal field and sort by value desc
    const cleanTokens = tokens
      .map(({ coingeckoId: _cg, ...rest }) => rest)
      .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));

    const totalUsdValue = cleanTokens.reduce((sum, t) => sum + (t.usdValue ?? 0), 0);
    return res.json({ address, tokens: cleanTokens, totalUsdValue });
  } catch (err) {
    req.log.error({ err }, "Wallet fetch error");
    return res.status(500).json({ error: "Failed to fetch wallet data" });
  }
});

export default router;
