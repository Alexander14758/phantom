import { useQuery } from "@tanstack/react-query";
import { type Balances } from "./useProfile";

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  return domain ? `https://${domain}` : "";
}

async function fetchPrices(): Promise<CoinMarketData[]> {
  const res = await fetch(`${getApiBase()}/api/prices`);
  if (!res.ok) throw new Error("Failed to fetch prices");
  return res.json() as Promise<CoinMarketData[]>;
}

async function fetchWalletTokens(address: string): Promise<WalletResponse> {
  const res = await fetch(`${getApiBase()}/api/wallet/${address}`);
  if (!res.ok) throw new Error("Failed to fetch wallet");
  return res.json() as Promise<WalletResponse>;
}

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
  verified: boolean;
  isExternal?: boolean;
}

// CoinGecko stable image fallbacks
const FALLBACK_IMAGES: Record<string, string> = {
  solana: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
  bitcoin: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
  ethereum: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
};

export function usePortfolio(balances: Balances, connectedAddress?: string | null) {
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

  const {
    data: walletData,
    isLoading: walletLoading,
    refetch: refetchWallet,
  } = useQuery<WalletResponse>({
    queryKey: ["wallet-tokens", connectedAddress],
    queryFn: () => fetchWalletTokens(connectedAddress!),
    enabled: !!connectedAddress,
    staleTime: 30_000,
    retry: 1,
  });

  // Build price lookup map
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

  // Main three tokens
  const mainTokens: PortfolioToken[] = [
    {
      id: "solana",
      name: "Solana",
      symbol: "SOL",
      image: priceMap["solana"]?.image ?? FALLBACK_IMAGES["solana"],
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
      image: priceMap["bitcoin"]?.image ?? FALLBACK_IMAGES["bitcoin"],
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
      image: priceMap["ethereum"]?.image ?? FALLBACK_IMAGES["ethereum"],
      amount: balances.ethereum,
      price: priceMap["ethereum"]?.price ?? 0,
      value: balances.ethereum * (priceMap["ethereum"]?.price ?? 0),
      change24h: priceMap["ethereum"]?.change24h ?? 0,
      verified: true,
    },
  ];

  // External wallet tokens
  const externalTokens: PortfolioToken[] = (walletData?.tokens ?? []).map((t) => ({
    id: t.mint,
    name: t.name,
    symbol: t.symbol,
    image: t.logo ?? "",
    amount: t.amount,
    price: t.usdPrice ?? 0,
    value: t.usdValue ?? 0,
    change24h: t.priceChange24h ?? 0,
    verified: false,
    isExternal: true,
  }));

  const allTokens = [...mainTokens, ...externalTokens];
  const totalValue = allTokens.reduce((sum, t) => sum + t.value, 0);

  // Total 24h change in USD (from main tokens only, since external may lack data)
  const totalChange24h = mainTokens.reduce((sum, t) => {
    const prevValue = t.value / (1 + t.change24h / 100);
    return sum + (t.value - prevValue);
  }, 0);

  const refetch = async () => {
    await Promise.all([
      refetchPrices(),
      connectedAddress ? refetchWallet() : Promise.resolve(),
    ]);
  };

  return {
    tokens: allTokens,
    mainTokens,
    externalTokens,
    totalValue,
    totalChange24h,
    priceMap,
    isLoading: pricesLoading,
    walletLoading,
    pricesError,
    refetch,
  };
}
