import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Balances } from "./useProfile";

// ─── API helpers ───────────────────────────────────────────────────────────────

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  return domain ? `https://${domain}` : "";
}

function getWsUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  return domain
    ? `wss://${domain}/api/wallet-ws`
    : "ws://localhost:8080/api/wallet-ws";
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
  verified: boolean;
  isWallet?: boolean;
}

export type WsStatus = "disconnected" | "connecting" | "connected" | "error";

// ─── CoinGecko fallback images ────────────────────────────────────────────────

const FALLBACK_IMAGES: Record<string, string> = {
  solana: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
  bitcoin: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
  ethereum: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
};

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function usePortfolio(balances: Balances, connectedAddress?: string | null) {
  // ── CoinGecko prices for BTC / ETH / SOL (manual holdings) ──────────────
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

  // ── Wallet real-time state ────────────────────────────────────────────────
  const [walletData, setWalletData] = useState<WalletResponse | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const [pendingTx, setPendingTx] = useState(false); // transaction in-flight indicator

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const destroyedRef = useRef(false);

  // Open WebSocket connection when a wallet is connected
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
        if (!destroyedRef.current) {
          reconnectTimerRef.current = setTimeout(connect, 5_000);
        }
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (destroyedRef.current) { ws.close(); return; }
        setWsStatus("connected");
        ws.send(JSON.stringify({ type: "subscribe", address: connectedAddress }));

        // Heartbeat every 30 s to keep the connection alive through proxies
        if (pingTimerRef.current) clearInterval(pingTimerRef.current);
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
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
            // A tx was just detected — show loading hint before new data arrives
            setPendingTx(true);
          }
        } catch {
          // Ignore
        }
      };

      ws.onerror = () => {
        setWsStatus("error");
      };

      ws.onclose = () => {
        setWsStatus("disconnected");
        if (pingTimerRef.current) clearInterval(pingTimerRef.current);
        if (!destroyedRef.current) {
          reconnectTimerRef.current = setTimeout(connect, 3_000);
        }
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

  // Also poll as a safety net when WS is unhealthy (every 30 s)
  useEffect(() => {
    if (!connectedAddress) return;

    const poll = async () => {
      if (wsStatus !== "connected") {
        try {
          const res = await fetch(`${getApiBase()}/api/wallet/${connectedAddress}`);
          if (res.ok) {
            const data = (await res.json()) as WalletResponse;
            setWalletData(data);
          }
        } catch {
          // Silently ignore
        }
      }
    };

    const timer = setInterval(poll, 30_000);
    return () => clearInterval(timer);
  }, [connectedAddress, wsStatus]);

  // ── Build price map from CoinGecko ───────────────────────────────────────
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

  // ── Manual holdings (SOL / BTC / ETH) ────────────────────────────────────
  const mainTokens: PortfolioToken[] = [
    {
      id: "solana",
      name: "Solana",
      symbol: "SOL",
      image: priceMap["solana"]?.image ?? FALLBACK_IMAGES["solana"]!,
      amount: balances.solana,
      price: priceMap["solana"]?.price ?? 0,
      value: balances.solana * (priceMap["solana"]?.price ?? 0),
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
  ];

  // ── Wallet tokens from Helius real-time feed ──────────────────────────────
  const walletTokens: PortfolioToken[] = (walletData?.tokens ?? []).map((t) => ({
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

  const allTokens = [...mainTokens, ...walletTokens];
  const totalValue = allTokens.reduce((sum, t) => sum + t.value, 0);

  // 24h USD change (across all tokens that have change data)
  const totalChange24h = allTokens.reduce((sum, t) => {
    if (!t.change24h || !t.value) return sum;
    const prevValue = t.value / (1 + t.change24h / 100);
    return sum + (t.value - prevValue);
  }, 0);

  // ── Manual refetch (pull-to-refresh / clock tap) ──────────────────────────
  const refetch = useCallback(async () => {
    await refetchPrices();
    // Ask server to push fresh wallet data via WS
    if (wsRef.current?.readyState === WebSocket.OPEN && connectedAddress) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", address: connectedAddress }));
    } else if (connectedAddress) {
      // Fallback: REST fetch
      try {
        const res = await fetch(`${getApiBase()}/api/wallet/${connectedAddress}`);
        if (res.ok) setWalletData((await res.json()) as WalletResponse);
      } catch {
        // ignore
      }
    }
  }, [refetchPrices, connectedAddress]);

  return {
    tokens: allTokens,
    mainTokens,
    walletTokens,
    totalValue,
    totalChange24h,
    priceMap,
    isLoading: pricesLoading,
    walletLoading: wsStatus === "connecting" && !walletData,
    pricesError,
    wsStatus,
    pendingTx,
    refetch,
  };
}
