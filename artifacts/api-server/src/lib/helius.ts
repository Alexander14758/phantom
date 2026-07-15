import { logger } from "./logger";

const HELIUS_KEY = process.env["HELIUS_API_KEY"] ?? "";
export const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
// Enhanced WS endpoint supports transactionSubscribe
export const HELIUS_WSS_URL = `wss://atlas-mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HeliusPortfolioToken {
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  amount: number;
  decimals: number;
  usdPrice: number | null;
  usdValue: number | null;
  priceChange24h: number | null;
}

export interface HeliusPortfolio {
  address: string;
  tokens: HeliusPortfolioToken[];
  totalUsdValue: number;
  fetchedAt: number;
}

// ─── Helius DAS response shapes ───────────────────────────────────────────────

interface DASItem {
  interface: string;
  id: string;
  content?: {
    metadata?: { name?: string; symbol?: string; description?: string };
    links?: { image?: string };
    files?: Array<{ uri?: string; cdn_uri?: string; mime?: string }>;
  };
  token_info?: {
    symbol?: string;
    balance?: number;
    decimals?: number;
    token_program?: string;
    price_info?: {
      price_per_token?: number;
      total_price?: number;
      currency?: string;
    };
    mint_authority?: string;
    supply?: number;
  };
}

interface DASResponse {
  result?: {
    total?: number;
    limit?: number;
    items?: DASItem[];
    nativeBalance?: {
      lamports?: number;
      price_per_sol?: number;
    };
  };
  error?: { code?: number; message: string };
}

// ─── Known mint → CoinGecko ID mapping (for 24h change + fallback pricing) ───

const MINT_TO_GECKO: Record<string, string> = {
  So11111111111111111111111111111111111111112: "solana",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "usd-coin",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "tether",
  "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj": "lido-staked-sol",
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: "msol",
  bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1: "blazestake-staked-sol",
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "bonk",
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "jupiter-exchange-solana",
  WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk: "wen-4",
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: "dogwifcoin",
  "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr": "popcat",
  A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump: "fartcoin",
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": "raydium",
  orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE: "orca",
  SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt: "serum",
  MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey: "marinade",
  HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3: "pyth-network",
  "7i5KKsX2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfRx": "tensor",
};

// ─── Main fetch function ───────────────────────────────────────────────────────

export async function fetchPortfolio(address: string): Promise<HeliusPortfolio> {
  const response = await fetch(HELIUS_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "phantom-wallet",
      method: "getAssetsByOwner",
      params: {
        ownerAddress: address,
        displayOptions: {
          showFungible: true,
          showNativeBalance: true,
        },
        limit: 1000,
      },
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    throw new Error(`Helius DAS API HTTP ${response.status}`);
  }

  const data = (await response.json()) as DASResponse;

  if (data.error) {
    throw new Error(`Helius DAS API error: ${data.error.message}`);
  }

  const items = data.result?.items ?? [];
  const nativeBalance = data.result?.nativeBalance;

  const tokens: HeliusPortfolioToken[] = [];
  const needsCoinGeckoPricing: HeliusPortfolioToken[] = [];

  // ── Native SOL ────────────────────────────────────────────────────────────
  if (nativeBalance?.lamports && nativeBalance.lamports > 0) {
    const solAmount = nativeBalance.lamports / 1e9;
    const solPrice = nativeBalance.price_per_sol ?? null;
    const solToken: HeliusPortfolioToken = {
      mint: "So11111111111111111111111111111111111111112",
      symbol: "SOL",
      name: "Solana",
      logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
      amount: solAmount,
      decimals: 9,
      usdPrice: solPrice,
      usdValue: solPrice ? solAmount * solPrice : null,
      priceChange24h: null, // enriched below
    };
    tokens.push(solToken);
    needsCoinGeckoPricing.push(solToken); // always enrich SOL with 24h change
  }

  // ── Fungible SPL tokens ───────────────────────────────────────────────────
  for (const item of items) {
    if (
      item.interface !== "FungibleToken" &&
      item.interface !== "FungibleAsset"
    ) {
      continue;
    }

    const tokenInfo = item.token_info;
    if (!tokenInfo) continue;

    const rawBalance = tokenInfo.balance ?? 0;
    if (rawBalance <= 0) continue;

    const decimals = tokenInfo.decimals ?? 0;
    const amount = rawBalance / Math.pow(10, decimals);
    if (amount < 0.000001) continue; // skip dust

    const name =
      item.content?.metadata?.name ??
      tokenInfo.symbol ??
      item.id.slice(0, 8);
    const symbol = tokenInfo.symbol ?? item.id.slice(0, 6).toUpperCase();

    // Best-effort logo: prefer CDN uri, then plain uri, then links.image
    const logo =
      item.content?.files?.[0]?.cdn_uri ??
      item.content?.files?.[0]?.uri ??
      item.content?.links?.image ??
      null;

    const priceInfo = tokenInfo.price_info;
    const usdPrice = priceInfo?.price_per_token ?? null;

    const token: HeliusPortfolioToken = {
      mint: item.id,
      symbol,
      name,
      logo,
      amount,
      decimals,
      usdPrice,
      usdValue: usdPrice != null ? amount * usdPrice : null,
      priceChange24h: null,
    };

    tokens.push(token);

    // Enrich with CoinGecko if we know the ID (gets 24h change + confirms price)
    if (MINT_TO_GECKO[item.id]) {
      needsCoinGeckoPricing.push(token);
    } else if (usdPrice === null) {
      // No price at all — attempt CoinGecko
      needsCoinGeckoPricing.push(token);
    }
  }

  // ── CoinGecko enrichment ──────────────────────────────────────────────────
  if (needsCoinGeckoPricing.length > 0) {
    try {
      await enrichWithCoinGecko(needsCoinGeckoPricing);
    } catch (err) {
      logger.warn({ err }, "CoinGecko enrichment failed — using Helius prices only");
    }
  }

  // Sort by USD value descending, unknowns last
  tokens.sort((a, b) => (b.usdValue ?? -1) - (a.usdValue ?? -1));

  const totalUsdValue = tokens.reduce((sum, t) => sum + (t.usdValue ?? 0), 0);

  return { address, tokens, totalUsdValue, fetchedAt: Date.now() };
}

// ─── CoinGecko enrichment ─────────────────────────────────────────────────────

async function enrichWithCoinGecko(tokens: HeliusPortfolioToken[]): Promise<void> {
  const apiKey = process.env["COINGECKO_API_KEY"];

  // Collect gecko IDs for tokens we know
  const geckoIds = new Set<string>();
  const mintToGeckoId: Record<string, string> = {};

  for (const t of tokens) {
    const id = MINT_TO_GECKO[t.mint];
    if (id) {
      geckoIds.add(id);
      mintToGeckoId[t.mint] = id;
    }
  }

  if (geckoIds.size === 0) return;

  const headers: Record<string, string> = {};
  if (apiKey) headers["x-cg-demo-api-key"] = apiKey;

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${[...geckoIds].join(",")}&vs_currencies=usd&include_24hr_change=true`;

  const resp = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!resp.ok) return;

  const prices = (await resp.json()) as Record<
    string,
    { usd: number; usd_24h_change?: number }
  >;

  for (const token of tokens) {
    const geckoId = mintToGeckoId[token.mint];
    if (!geckoId) continue;
    const entry = prices[geckoId];
    if (!entry) continue;

    // CoinGecko is authoritative for price + 24h change
    token.usdPrice = entry.usd;
    token.usdValue = token.amount * entry.usd;
    token.priceChange24h = entry.usd_24h_change ?? null;
  }
}
