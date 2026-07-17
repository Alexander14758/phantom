import { useCallback, useEffect, useState } from 'react';
import { lsGet, lsRemove, lsSet } from '@/lib/storage';

export interface Profile {
  name: string;
  username: string;
  avatar: string;
}

export interface Balances {
  solana: number;
  bitcoin: number;
  ethereum: number;
  cash: number;
}

export interface ConnectedWallet {
  address: string;
}

const DEFAULT_PROFILE: Profile = { name: 'Shai', username: '@shai.crypto', avatar: '🔮' };
const DEFAULT_BALANCES: Balances = { solana: 3652.05, bitcoin: 0.3, ethereum: 2.5, cash: 5650 };

const KEYS = {
  PROFILE: '@wallet/profile',
  BALANCES: '@wallet/balances',
  CONNECTED_WALLET: '@wallet/connectedWallet',
};

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(() => lsGet(KEYS.PROFILE, DEFAULT_PROFILE));
  const [balances, setBalances] = useState<Balances>(() => lsGet(KEYS.BALANCES, DEFAULT_BALANCES));
  const [connectedWallet, setConnectedWallet] = useState<ConnectedWallet | null>(() =>
    lsGet<ConnectedWallet | null>(KEYS.CONNECTED_WALLET, null)
  );

  const saveProfile = useCallback((updates: Partial<Profile>) => {
    setProfile(prev => {
      const next = { ...prev, ...updates };
      lsSet(KEYS.PROFILE, next);
      return next;
    });
  }, []);

  const saveBalances = useCallback((updates: Partial<Balances>) => {
    setBalances(prev => {
      const next = { ...prev, ...updates };
      lsSet(KEYS.BALANCES, next);
      return next;
    });
  }, []);

  const saveConnectedWallet = useCallback((wallet: ConnectedWallet | null) => {
    setConnectedWallet(wallet);
    if (wallet) lsSet(KEYS.CONNECTED_WALLET, wallet);
    else lsRemove(KEYS.CONNECTED_WALLET);
  }, []);

  return { profile, balances, connectedWallet, saveProfile, saveBalances, saveConnectedWallet };
}
