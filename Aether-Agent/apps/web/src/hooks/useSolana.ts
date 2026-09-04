'use client';

import { useCallback, useEffect, useState } from 'react';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

type WalletProvider = {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
};

type SolanaWindow = Window & {
  solana?: WalletProvider;
  phantom?: WalletProvider;
};

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

function getProvider(): WalletProvider | null {
  if (typeof window === 'undefined') return null;
  const w = window as SolanaWindow;
  return w.phantom ?? w.solana ?? null;
}

/**
 * useSolana — wallet connection + balance for on-chain crisis reporting.
 * Works with Phantom and any injected Solana wallet provider.
 */
export function useSolana() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [walletAvailable, setWalletAvailable] = useState(false);

  useEffect(() => {
    setWalletAvailable(getProvider() !== null);
  }, []);

  const refreshBalance = useCallback(async (key: string) => {
    try {
      const connection = new Connection(RPC_URL, 'confirmed');
      const lamports = await connection.getBalance(new PublicKey(key));
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch {
      setBalance(null); // RPC unreachable — balance display is optional.
    }
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setError('No Solana wallet found. Install Phantom to log crises on-chain.');
      return;
    }
    setConnecting(true);
    setError('');
    try {
      const { publicKey: pk } = await provider.connect();
      const key = pk.toString();
      setPublicKey(key);
      await refreshBalance(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wallet connection rejected.');
    } finally {
      setConnecting(false);
    }
  }, [refreshBalance]);

  const disconnect = useCallback(async () => {
    try {
      await getProvider()?.disconnect();
    } catch {
      // ignore — wallet already gone
    }
    setPublicKey(null);
    setBalance(null);
  }, []);

  return {
    publicKey,
    balance,
    connecting,
    error,
    walletAvailable,
    connect,
    disconnect,
  };
}