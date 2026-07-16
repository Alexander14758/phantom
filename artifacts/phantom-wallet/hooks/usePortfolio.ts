import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type Balances } from "./useProfile";

// ─── Storage keys ─────────────────────────────────────────────────────────────
const STORE = {
  REMOVED: "@portfolio/removed_mints",
  OVERRIDES: "@portfolio/token_overrides",
  WALLET_LIMIT: "@portfolio/wallet_limit",
} as const;

const SOL_MINT = "So11111111111111111111111111111111111111112";

// ─── API helpers ───────────────────────────────────────────────────────────────
function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  return domain ? `https://${domain}` : "";
}

function getWsUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  return domain ? `wss://${domain}/api/wallet-ws` : "ws://localhost:8080/api/wallet-ws";
}

async function fetchPrices(): Promise<CoinMarketData[]> {
  const res = await fetch(`${getApiBase()}/api/prices`);
  if (!res.ok) throw new Error("Failed to fetch prices");
  return res.json() as Promise<CoinMarketData[]>;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number | null;
}

export interface WalletToken {
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  amount: number;
  decimals: number;
  usdValue: number | null;
  usdPrice: number | null;
  priceChange24h: number | null;
}

export interface WalletResponse {
  address: string;
  tokens: WalletToken[];
  totalUsdValue: number;
  fetchedAt?: number;
}

export interface PortfolioToken {
  id: string;
  name: string;
  symbol: string;
  image: string;
  amount: number;
  price: number;
  value: number;
  change24h: number;
  /** User-set P&L override in USD (signed: positive = profit, negative = loss) */
  pnlUsdOverride?: number;
  verified: boolean;
  isWallet?: boolean;
}

export interface TokenOverride {
  balance?: number;
  pnlUsd?: number; // signed USD P&L
}

export type WsStatus = "disconnected" | "connecting" | "connected" | "error";

// ─── Fallback images ───────────────────────────────────────────────────────────
const FALLBACK_IMAGES: Record<string, string> = {
  solana: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
  bitcoin: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
  ethereum: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
};

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function usePortfolio(balances: Balances, connectedAddress?: string | null) {
  // ── Prices from CoinGecko ──────────────────────────────────────────────────
  const {
    data: pricesData,
    isLoading: pricesLoading,
    refetch: refetchPrices,
    error: pricesError,
  } = useQuery<CoinMarketData[]>({
    queryKey: ["crypto-prices"],
    queryFn: fetchPrices,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 2,
  });

  // ── Wallet real-time state ─────────────────────────────────────────────────
  const [walletData, setWalletData] = useState<WalletResponse | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const [pendingTx, setPendingTx] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const destroyedRef = useRef(false);

  // ── Token customization (removed & overrides) ─────────────────────────────
  const [removedMints, setRemovedMints] = useState<Set<string>>(new Set());
  const [tokenOverrides, setTokenOverrides] = useState<Record<string, TokenOverride>>({});
  const [walletDisplayLimit, setWalletDisplayLimitState] = useState<number>(0); // 0 = show all
  const overridesLoaded = useRef(false);

  useEffect(() => {
    AsyncStorage.multiGet([STORE.REMOVED, STORE.OVERRIDES, STORE.WALLET_LIMIT])
      .then(([[, rv], [, ov], [, wl]]) => {
        if (rv) setRemovedMints(new Set(JSON.parse(rv) as string[]));
        if (ov) setTokenOverrides(JSON.parse(ov) as Record<string, TokenOverride>);
        if (wl) setWalletDisplayLimitState(JSON.parse(wl) as number);
        overridesLoaded.current = true;
      })
      .catch(() => { overridesLoaded.current = true; });
  }, []);

  const removeToken = useCallback((id: string) => {
    setRemovedMints((prev) => {
      const next = new Set(prev);
      next.add(id);
      void AsyncStorage.setItem(STORE.REMOVED, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const restoreToken = useCallback((id: string) => {
    setRemovedMints((prev) => {
      const next = new Set(prev);
      next.delete(id);
      void AsyncStorage.setItem(STORE.REMOVED, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const setWalletLimit = useCallback((limit: number) => {
    setWalletDisplayLimitState(limit);
    void AsyncStorage.setItem(STORE.WALLET_LIMIT, JSON.stringify(limit));
  }, []);

  const editToken = useCallback((id: string, balance: number, pnlUsd: number | null) => {
    setTokenOverrides((prev) => {
      const next: Record<string, TokenOverride> = {
        ...prev,
        [id]: { balance, pnlUsd: pnlUsd ?? undefined },
      };
      void AsyncStorage.setItem(STORE.OVERRIDES, JSON.stringify(next));
      return next;
    });
  }, []);

  // ── WebSocket connection ───────────────────────────────────────────────────
  useEffect(() => {
    if (!connectedAddress) {
      setWalletData(null);
      setWsStatus("disconnected");
      return;
    }

    destroyedRef.current = false;

    const connect = () => {
      if (destroyedRef.current) return;
      setWsStatus("connecting");

      let ws: WebSocket;
      try {
        ws = new WebSocket(getWsUrl());
      } catch {
        setWsStatus("error");
        if (!destroyedRef.current) reconnectTimerRef.current = setTimeout(connect, 5_000);
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (destroyedRef.current) { ws.close(); return; }
        setWsStatus("connected");
        ws.send(JSON.stringify({ type: "subscribe", address: connectedAddress }));
        if (pingTimerRef.current) clearInterval(pingTimerRef.current);
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, 30_000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            data?: WalletResponse;
            signature?: string;
          };
          if (msg.type === "portfolio" && msg.data) {
            setWalletData(msg.data);
            setPendingTx(false);
          } else if (msg.type === "transaction") {
            setPendingTx(true);
          }
        } catch { /* ignore */ }
      };

      ws.onerror = () => setWsStatus("error");
      ws.onclose = () => {
        setWsStatus("disconnected");
        if (pingTimerRef.current) clearInterval(pingTimerRef.current);
        if (!destroyedRef.current) reconnectTimerRef.current = setTimeout(connect, 3_000);
      };
    };

    connect();

    return () => {
      destroyedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
      setWsStatus("disconnected");
      setPendingTx(false);
    };
  }, [connectedAddress]);

  // Polling fallback when WS is unhealthy
  useEffect(() => {
    if (!connectedAddress) return;
    const poll = async () => {
      if (wsStatus !== "connected") {
        try {
          const res = await fetch(`${getApiBase()}/api/wallet/${connectedAddress}`);
          if (res.ok) setWalletData((await res.json()) as WalletResponse);
        } catch { /* ignore */ }
      }
    };
    const t = setInterval(poll, 30_000);
    return () => clearInterval(t);
  }, [connectedAddress, wsStatus]);

  // ── Price map ──────────────────────────────────────────────────────────────
  type PriceEntry = { price: number; change24h: number; image: string };
  const priceMap: Record<string, PriceEntry> = {};
  if (pricesData) {
    for (const coin of pricesData) {
      priceMap[coin.id] = {
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h ?? 0,
        image: coin.image,
      };
    }
  }

  // ── Apply override to a token ──────────────────────────────────────────────
  const applyOverride = (token: PortfolioToken): PortfolioToken => {
    const ov = tokenOverrides[token.id];
    if (!ov) return token;
    const amount = ov.balance !== undefined ? ov.balance : token.amount;
    const value = amount * token.price;
    return {
      ...token,
      amount,
      value,
      pnlUsdOverride: ov.pnlUsd,
    };
  };

  // ── Find wallet SOL to auto-replace manual SOL balance ────────────────────
  const walletSolToken = walletData?.tokens.find((t) => t.mint === SOL_MINT);
  const effectiveSolAmount = walletSolToken ? walletSolToken.amount : balances.solana;
  // Use Helius price for SOL if wallet is connected (it's fresh), else CoinGecko
  const effectiveSolPrice = walletSolToken?.usdPrice ?? priceMap["solana"]?.price ?? 0;

  // ── Main holdings (SOL auto-replaces from wallet, BTC/ETH always manual) ──
  const mainTokens: PortfolioToken[] = [
    {
      id: "solana",
      name: "Solana",
      symbol: "SOL",
      image: priceMap["solana"]?.image ?? FALLBACK_IMAGES["solana"]!,
      amount: effectiveSolAmount,
      price: effectiveSolPrice,
      value: effectiveSolAmount * effectiveSolPrice,
      change24h: priceMap["solana"]?.change24h ?? 0,
      verified: true,
    },
    {
      id: "bitcoin",
      name: "Bitcoin",
      symbol: "BTC",
      image: priceMap["bitcoin"]?.image ?? FALLBACK_IMAGES["bitcoin"]!,
      amount: balances.bitcoin,
      price: priceMap["bitcoin"]?.price ?? 0,
      value: balances.bitcoin * (priceMap["bitcoin"]?.price ?? 0),
      change24h: priceMap["bitcoin"]?.change24h ?? 0,
      verified: true,
    },
    {
      id: "ethereum",
      name: "Ethereum",
      symbol: "ETH",
      image: priceMap["ethereum"]?.image ?? FALLBACK_IMAGES["ethereum"]!,
      amount: balances.ethereum,
      price: priceMap["ethereum"]?.price ?? 0,
      value: balances.ethereum * (priceMap["ethereum"]?.price ?? 0),
      change24h: priceMap["ethereum"]?.change24h ?? 0,
      verified: true,
    },
  ]
    .filter((t) => !removedMints.has(t.id))
    .map(applyOverride);

  // ── All wallet tokens from Helius (full list, for management UI) ─────────
  const allWalletTokens: PortfolioToken[] = (walletData?.tokens ?? [])
    .filter((t) => t.mint !== SOL_MINT)
    .map((t): PortfolioToken => ({
      id: t.mint,
      name: t.name,
      symbol: t.symbol,
      image: t.logo ?? "",
      amount: t.amount,
      price: t.usdPrice ?? 0,
      value: t.usdValue ?? 0,
      change24h: t.priceChange24h ?? 0,
      verified: false,
      isWallet: true,
    }));

  // Wallet tokens shown on dashboard (removed + limit applied)
  const walletTokensFiltered: PortfolioToken[] = allWalletTokens
    .filter((t) => !removedMints.has(t.id))
    .map(applyOverride);

  const walletTokens =
    walletDisplayLimit > 0
      ? walletTokensFiltered.slice(0, walletDisplayLimit)
      : walletTokensFiltered;

  const allTokens = [...mainTokens, ...walletTokens];
  const totalValue = allTokens.reduce((s, t) => s + t.value, 0);

  const totalChange24h = allTokens.reduce((sum, t) => {
    if (t.pnlUsdOverride !== undefined) return sum + t.pnlUsdOverride;
    if (!t.change24h || !t.value) return sum;
    return sum + (t.value - t.value / (1 + t.change24h / 100));
  }, 0);

  // ── Manual refetch ─────────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    await refetchPrices();
    if (wsRef.current?.readyState === WebSocket.OPEN && connectedAddress) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", address: connectedAddress }));
    } else if (connectedAddress) {
      try {
        const res = await fetch(`${getApiBase()}/api/wallet/${connectedAddress}`);
        if (res.ok) setWalletData((await res.json()) as WalletResponse);
      } catch { /* ignore */ }
    }
  }, [refetchPrices, connectedAddress]);

  return {
    tokens: allTokens,
    mainTokens,
    walletTokens,
    allWalletTokens,
    totalValue,
    totalChange24h,
    priceMap,
    isLoading: pricesLoading,
    walletLoading: wsStatus === "connecting" && !walletData,
    pricesError,
    wsStatus,
    pendingTx,
    removedMints,
    walletDisplayLimit,
    removeToken,
    restoreToken,
    setWalletLimit,
    editToken,
    refetch,
  };
}
