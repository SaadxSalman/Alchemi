'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { trpc, useBackendHealth } from '../hooks/useTRPC';
import { useSolana } from '../hooks/useSolana';
import { WalletButton } from '../components/WalletButton';
import { AidDashboard } from '../components/AidDashboard';
import { MemorySearch } from '../components/MemorySearch';

export default function Dashboard() {
  const health = useBackendHealth();
  const wallet = useSolana();

  const utils = trpc.useUtils();
  const crisesQuery = trpc.monitor.getActiveCrises.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const statsQuery = trpc.monitor.getStats.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const [imageUrl, setImageUrl] = useState(
    'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80'
  );

  const analyze = trpc.monitor.analyzeSatellite.useMutation({
    onSuccess: () => {
      void utils.monitor.getActiveCrises.invalidate();
      void utils.monitor.getStats.invalidate();
    },
  });

  const report = trpc.solana.reportCrisis.useMutation({
    onSuccess: () => {
      void utils.monitor.getActiveCrises.invalidate();
    },
  });

  const crises = crisesQuery.data ?? [];
  const target = useMemo(() => {
    if (analyze.data) {
      return {
        id: analyze.data.id,
        type: analyze.data.type,
        severity: Number(analyze.data.severity),
      };
    }
    const worst = [...crises].sort((a, b) => b.severity - a.severity)[0];
    return worst
      ? { id: worst.id, type: worst.type, severity: worst.severity }
      : undefined;
  }, [analyze.data, crises]);

  const allocation = trpc.allocation.estimateNeeds.useQuery(
    {
      crisisType: target?.type ?? 'Flood',
      severity: target?.severity ?? 0.5,
    },
    { enabled: Boolean(target) }
  );

  const handleAnalyze = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    analyze.mutate({ imageUrl });
  };

  const handleLogOnChain = () => {
    if (!wallet.publicKey || !target) return;
    const persistedId =
      target.id.startsWith('seed-') || target.id.startsWith('mock-')
        ? undefined
        : target.id;
    report.mutate({
      crisisId: persistedId,
      authority: wallet.publicKey,
      crisisType: target.type,
      severity: target.severity,
    });
  };

  const statusBadge =
    health === null
      ? { text: 'Connecting…', cls: 'border-slate-600 bg-slate-800 text-slate-300' }
      : health
        ? { text: 'Real-time monitoring', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' }
        : { text: 'Backend offline', cls: 'border-rose-500/30 bg-rose-500/10 text-rose-300' };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-sky-950/30">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">Aether-Agent</p>
              <h1 className="mt-2 text-4xl font-bold">Crisis Monitor</h1>
            </div>
            <div className="flex items-center gap-3">
              <WalletButton
                publicKey={wallet.publicKey}
                balance={wallet.balance}
                connecting={wallet.connecting}
                walletAvailable={wallet.walletAvailable}
                onConnect={() => void wallet.connect()}
                onDisconnect={() => void wallet.disconnect()}
              />
              <span className={`rounded-full border px-3 py-1 text-sm font-medium ${statusBadge.cls}`}>
                {statusBadge.text}
              </span>
            </div>
          </div>
          {wallet.error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {wallet.error}
            </p>
          ) : null}
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-3xl font-bold text-cyan-300">{statsQuery.data?.active ?? '—'}</p>
            <p className="text-sm text-slate-400">Active crises</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-3xl font-bold text-rose-300">{statsQuery.data?.critical ?? '—'}</p>
            <p className="text-sm text-slate-400">Critical (severity ≥ 75%)</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-3xl font-bold text-amber-300">{statsQuery.data?.mostCommonType ?? '—'}</p>
            <p className="text-sm text-slate-400">Most common type</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-4 text-xl font-semibold">Active incidents</h2>
            {crisesQuery.isLoading ? (
              <p className="text-slate-300">Scanning satellite data and incident feeds…</p>
            ) : crises.length === 0 ? (
              <p className="text-slate-300">No active crises detected yet — run an analysis below.</p>
            ) : (
              <div className="space-y-4">
                {crises.map((crisis) => (
                  <article key={crisis.id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{crisis.type}</h3>
                        <p className="text-sm text-slate-400">{crisis.location}</p>
                      </div>
                      <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-bold uppercase tracking-wide text-amber-300">
                        {crisis.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-300">
                      <span>Severity: {(crisis.severity * 100).toFixed(0)}%</span>
                      <span>Confidence: {((crisis.confidence ?? 0.8) * 100).toFixed(0)}%</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-4 text-xl font-semibold">Analyze satellite image</h2>
            <form onSubmit={handleAnalyze} className="space-y-4">
              <label className="block text-sm font-medium text-slate-300">
                Image URL
                <input
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500"
                  placeholder="https://example.com/flood.png"
                />
              </label>

              <button
                type="submit"
                disabled={analyze.isPending}
                className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {analyze.isPending ? 'Scanning…' : 'Run crisis analysis'}
              </button>
            </form>

            {analyze.error ? (
              <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                Analysis failed: {analyze.error.message}
              </p>
            ) : null}
            {analyze.data ? (
              <div className="mt-4 space-y-2">
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
                  {analyze.data.message} Detected {analyze.data.type} at{' '}
                  {(Number(analyze.data.severity) * 100).toFixed(0)}% severity
                  {analyze.data.vectorMemory ? ' (stored in vector memory)' : ''}.
                </div>
                {analyze.data.similar.length > 0 ? (
                  <p className="text-xs text-slate-400">
                    {analyze.data.similar.length} similar past event(s) found in memory.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <AidDashboard
            allocation={allocation.data}
            isLoading={allocation.isPending}
            logging={report.isPending}
            disabled={!wallet.publicKey || !target}
            onLogOnChain={handleLogOnChain}
            txSignature={report.data?.signature ?? null}
          />
          <MemorySearch />
        </section>
      </div>
    </main>
  );
}