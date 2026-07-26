import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { lsGet, lsSet } from '@/lib/storage';
import type { Balances } from './useProfile';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

const STORE = {
  REMOVED: '@portfolio/removed_mints',
  OVERRIDES: '@portfolio/token_overrides',
  WALLET_LIMIT: '@portfolio/wallet_limit',
  CUSTOM_TOKENS: '@portfolio/custom_tokens',
};

const FALLBACK_IMAGES: Record<string, string> = {
  solana: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
  bitcoin: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
  ethereum: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
};

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
  pnlUsdOverride?: number;
  verified: boolean;
  isWallet?: boolean;
  isCustom?: boolean;
}

export interface TokenOverride {
  balance?: number;
  pnlUsd?: number;
}

export interface CustomToken {
  id: string;
  name: string;
  symbol: string;
  amount: number;
  priceUsd: number;
}

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/api/wallet-ws`;
}

async function fetchPrices(): Promise<CoinMarketData[]> {
  const res = await fetch('/api/prices');
  if (!res.ok) throw new Error('Failed to fetch prices');
  return res.json() as Promise<CoinMarketData[]>;
}

export function usePortfolio(balances: Balances, connectedAddress?: string | null) {
  const { data: pricesData, isLoading: pricesLoading, refetch: refetchPrices, error: pricesError } =
    useQuery<CoinMarketData[]>({
      queryKey: ['crypto-prices'],
      queryFn: fetchPrices,
      staleTime: 30_000,
      refetchInterval: 60_000,
      retry: 2,
    });

  const [walletData, setWalletData] = useState<WalletResponse | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected');
  const [pendingTx, setPendingTx] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const destroyedRef = useRef(false);

  const [removedMints, setRemovedMints] = useState<Set<string>>(
    () => new Set(lsGet<string[]>(STORE.REMOVED, []))
  );
  const [tokenOverrides, setTokenOverrides] = useState<Record<string, TokenOverride>>(
    () => lsGet<Record<string, TokenOverride>>(STORE.OVERRIDES, {})
  );
  const [walletDisplayLimit, setWalletDisplayLimitState] = useState<number>(
    () => lsGet<number>(STORE.WALLET_LIMIT, 0)
  );
  const [customTokens, setCustomTokens] = useState<CustomToken[]>(
    () => lsGet<CustomToken[]>(STORE.CUSTOM_TOKENS, [])
  );

  const removeToken = useCallback((id: string) => {
    setRemovedMints(prev => {
      const next = new Set(prev);
      next.add(id);
      lsSet(STORE.REMOVED, [...next]);
      return next;
    });
  }, []);

  const restoreToken = useCallback((id: string) => {
    setRemovedMints(prev => {
      const next = new Set(prev);
      next.delete(id);
      lsSet(STORE.REMOVED, [...next]);
      return next;
    });
  }, []);

  const setWalletLimit = useCallback((limit: number) => {
    setWalletDisplayLimitState(limit);
    lsSet(STORE.WALLET_LIMIT, limit);
  }, []);

  const editToken = useCallback((id: string, balance: number, pnlUsd: number | null) => {
    setTokenOverrides(prev => {
      const next = { ...prev, [id]: { balance, pnlUsd: pnlUsd ?? undefined } };
      lsSet(STORE.OVERRIDES, next);
      return next;
    });
  }, []);

  const addCustomToken = useCallback((token: Omit<CustomToken, 'id'>) => {
    const newToken: CustomToken = { ...token, id: `custom_${Date.now()}` };
    setCustomTokens(prev => {
      const next = [...prev, newToken];
      lsSet(STORE.CUSTOM_TOKENS, next);
      return next;
    });
  }, []);

  const deleteCustomToken = useCallback((id: string) => {
    setCustomTokens(prev => {
      const next = prev.filter(t => t.id !== id);
      lsSet(STORE.CUSTOM_TOKENS, next);
      return next;
    });
  }, []);

  const updateCustomToken = useCallback((id: string, updates: Partial<Omit<CustomToken, 'id'>>) => {
    setCustomTokens(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      lsSet(STORE.CUSTOM_TOKENS, next);
      return next;
    });
  }, []);

  // WebSocket connection
  useEffect(() => {
    if (!connectedAddress) {
      setWalletData(null);
      setWsStatus('disconnected');
      return;
    }
    destroyedRef.current = false;

    const connect = () => {
      if (destroyedRef.current) return;
      setWsStatus('connecting');
      let ws: WebSocket;
      try { ws = new WebSocket(getWsUrl()); }
      catch {
        setWsStatus('error');
        if (!destroyedRef.current) reconnectTimerRef.current = setTimeout(connect, 5_000);
        return;
      }
      wsRef.current = ws;
      ws.onopen = () => {
        if (destroyedRef.current) { ws.close(); return; }
        setWsStatus('connected');
        ws.send(JSON.stringify({ type: 'subscribe', address: connectedAddress }));
        if (pingTimerRef.current) clearInterval(pingTimerRef.current);
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
        }, 30_000);
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; data?: WalletResponse };
          if (msg.type === 'portfolio' && msg.data) { setWalletData(msg.data); setPendingTx(false); }
          else if (msg.type === 'transaction') setPendingTx(true);
        } catch { /* ignore */ }
      };
      ws.onerror = () => setWsStatus('error');
      ws.onclose = () => {
        setWsStatus('disconnected');
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
      setWsStatus('disconnected');
      setPendingTx(false);
    };
  }, [connectedAddress]);

  // Polling fallback
  useEffect(() => {
    if (!connectedAddress) return;
    const poll = async () => {
      if (wsStatus !== 'connected') {
        try {
          const res = await fetch(`/api/wallet/${connectedAddress}`);
          if (res.ok) setWalletData((await res.json()) as WalletResponse);
        } catch { /* ignore */ }
      }
    };
    const t = setInterval(poll, 30_000);
    return () => clearInterval(t);
  }, [connectedAddress, wsStatus]);

  // Price map
  type PriceEntry = { price: number; change24h: number; image: string };
  const priceMap: Record<string, PriceEntry> = {};
  if (pricesData) {
    for (const coin of pricesData) {
      priceMap[coin.id] = { price: coin.current_price, change24h: coin.price_change_percentage_24h ?? 0, image: coin.image };
    }
  }

  const applyOverride = (token: PortfolioToken): PortfolioToken => {
    const ov = tokenOverrides[token.id];
    if (!ov) return token;
    const amount = ov.balance !== undefined ? ov.balance : token.amount;
    return { ...token, amount, value: amount * token.price, pnlUsdOverride: ov.pnlUsd };
  };

  const walletSolToken = walletData?.tokens.find(t => t.mint === SOL_MINT);
  const effectiveSolAmount = walletSolToken ? walletSolToken.amount : balances.solana;
  const effectiveSolPrice = walletSolToken?.usdPrice ?? priceMap['solana']?.price ?? 0;

  const mainTokens: PortfolioToken[] = [
    { id: 'solana', name: 'Solana', symbol: 'SOL', image: priceMap['solana']?.image ?? FALLBACK_IMAGES['solana']!, amount: effectiveSolAmount, price: effectiveSolPrice, value: effectiveSolAmount * effectiveSolPrice, change24h: priceMap['solana']?.change24h ?? 0, verified: true },
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', image: priceMap['bitcoin']?.image ?? FALLBACK_IMAGES['bitcoin']!, amount: balances.bitcoin, price: priceMap['bitcoin']?.price ?? 0, value: balances.bitcoin * (priceMap['bitcoin']?.price ?? 0), change24h: priceMap['bitcoin']?.change24h ?? 0, verified: true },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', image: priceMap['ethereum']?.image ?? FALLBACK_IMAGES['ethereum']!, amount: balances.ethereum, price: priceMap['ethereum']?.price ?? 0, value: balances.ethereum * (priceMap['ethereum']?.price ?? 0), change24h: priceMap['ethereum']?.change24h ?? 0, verified: true },
  ].filter(t => !removedMints.has(t.id)).map(applyOverride);

  const allWalletTokens: PortfolioToken[] = (walletData?.tokens ?? [])
    .filter(t => t.mint !== SOL_MINT)
    .map((t): PortfolioToken => ({ id: t.mint, name: t.name, symbol: t.symbol, image: t.logo ?? '', amount: t.amount, price: t.usdPrice ?? 0, value: t.usdValue ?? 0, change24h: t.priceChange24h ?? 0, verified: false, isWallet: true }));

  const walletTokensFiltered = allWalletTokens.filter(t => !removedMints.has(t.id)).map(applyOverride);
  const walletTokens = walletDisplayLimit > 0 ? walletTokensFiltered.slice(0, walletDisplayLimit) : walletTokensFiltered;

  // Custom tokens → PortfolioToken shape
  const customPortfolioTokens: PortfolioToken[] = customTokens
    .filter(t => !removedMints.has(t.id))
    .map((t): PortfolioToken => ({
      id: t.id,
      name: t.name,
      symbol: t.symbol.toUpperCase(),
      image: '',
      amount: t.amount,
      price: t.priceUsd,
      value: t.amount * t.priceUsd,
      change24h: 0,
      verified: false,
      isCustom: true,
    }));

  const allTokens = [...mainTokens, ...walletTokens, ...customPortfolioTokens];
  const totalValue = allTokens.reduce((s, t) => s + t.value, 0);
  const totalChange24h = allTokens.reduce((sum, t) => {
    if (t.pnlUsdOverride !== undefined) return sum + t.pnlUsdOverride;
    if (!t.change24h || !t.value) return sum;
    return sum + (t.value - t.value / (1 + t.change24h / 100));
  }, 0);

  const refetch = useCallback(async () => {
    await refetchPrices();
    if (wsRef.current?.readyState === WebSocket.OPEN && connectedAddress) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', address: connectedAddress }));
    } else if (connectedAddress) {
      try {
        const res = await fetch(`/api/wallet/${connectedAddress}`);
        if (res.ok) setWalletData((await res.json()) as WalletResponse);
      } catch { /* ignore */ }
    }
  }, [refetchPrices, connectedAddress]);

  return {
    tokens: allTokens, mainTokens, walletTokens, allWalletTokens,
    customTokens,
    totalValue, totalChange24h, priceMap,
    isLoading: pricesLoading, pricesError, wsStatus, pendingTx,
    removedMints, walletDisplayLimit,
    removeToken, restoreToken, setWalletLimit, editToken,
    addCustomToken, deleteCustomToken, updateCustomToken,
    refetch,
  };
}
