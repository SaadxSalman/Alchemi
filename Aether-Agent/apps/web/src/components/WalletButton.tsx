'use client';

interface WalletButtonProps {
  publicKey: string | null;
  balance: number | null;
  connecting: boolean;
  walletAvailable: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

const shorten = (key: string) => `${key.slice(0, 4)}…${key.slice(-4)}`;

export function WalletButton({
  publicKey,
  balance,
  connecting,
  walletAvailable,
  onConnect,
  onDisconnect,
}: WalletButtonProps) {
  if (publicKey) {
    return (
      <button
        onClick={onDisconnect}
        className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
        title={publicKey}
      >
        {shorten(publicKey)}
        {balance !== null ? ` · ${balance.toFixed(2)} SOL` : ''}
      </button>
    );
  }

  return (
    <button
      onClick={onConnect}
      disabled={connecting || !walletAvailable}
      className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-1.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      title={walletAvailable ? 'Connect Solana wallet' : 'Install a Solana wallet (e.g. Phantom)'}
    >
      {connecting ? 'Connecting…' : walletAvailable ? 'Connect Wallet' : 'No Wallet Detected'}
    </button>
  );
}