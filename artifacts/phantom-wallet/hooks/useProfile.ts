import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export interface Profile {
  name: string;
  username: string;
  avatar: string; // emoji character
}

export interface Balances {
  solana: number;
  bitcoin: number;
  ethereum: number;
}

export interface ConnectedWallet {
  address: string;
}

const DEFAULT_PROFILE: Profile = {
  name: "Shai",
  username: "@shai.crypto",
  avatar: "🔮",
};

const DEFAULT_BALANCES: Balances = {
  solana: 3652.05,
  bitcoin: 0.3,
  ethereum: 2.5,
};

const KEYS = {
  PROFILE: "@wallet/profile",
  BALANCES: "@wallet/balances",
  CONNECTED_WALLET: "@wallet/connectedWallet",
};

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [balances, setBalances] = useState<Balances>(DEFAULT_BALANCES);
  const [connectedWallet, setConnectedWallet] = useState<ConnectedWallet | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [profileStr, balancesStr, walletStr] = await Promise.all([
          AsyncStorage.getItem(KEYS.PROFILE),
          AsyncStorage.getItem(KEYS.BALANCES),
          AsyncStorage.getItem(KEYS.CONNECTED_WALLET),
        ]);
        if (profileStr) setProfile(JSON.parse(profileStr) as Profile);
        if (balancesStr) setBalances(JSON.parse(balancesStr) as Balances);
        if (walletStr) setConnectedWallet(JSON.parse(walletStr) as ConnectedWallet);
      } catch {
        // Use defaults
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const saveProfile = useCallback(
    async (updates: Partial<Profile>) => {
      const next = { ...profile, ...updates };
      setProfile(next);
      await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(next));
    },
    [profile]
  );

  const saveBalances = useCallback(
    async (updates: Partial<Balances>) => {
      const next = { ...balances, ...updates };
      setBalances(next);
      await AsyncStorage.setItem(KEYS.BALANCES, JSON.stringify(next));
    },
    [balances]
  );

  const saveConnectedWallet = useCallback(async (wallet: ConnectedWallet | null) => {
    setConnectedWallet(wallet);
    if (wallet) {
      await AsyncStorage.setItem(KEYS.CONNECTED_WALLET, JSON.stringify(wallet));
    } else {
      await AsyncStorage.removeItem(KEYS.CONNECTED_WALLET);
    }
  }, []);

  return {
    profile,
    balances,
    connectedWallet,
    loaded,
    saveProfile,
    saveBalances,
    saveConnectedWallet,
  };
}
