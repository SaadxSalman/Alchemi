'use client';

import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../../backend-node/src/trpc/routers/_app';

type AllocationOutput = inferRouterOutputs<AppRouter>['allocation']['estimateNeeds'];

interface AidDashboardProps {
  allocation?: AllocationOutput;
  isLoading: boolean;
  logging: boolean;
  disabled: boolean;
  onLogOnChain: () => void;
  txSignature?: string | null;
}

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);

const priorityStyles: Record<string, string> = {
  low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  high: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  critical: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

/**
 * Resource Allocation panel — shows the predicted aid package for the
 * most severe active crisis and lets a connected wallet log it on-chain.
 */
export function AidDashboard({
  allocation,
  isLoading,
  logging,
  disabled,
  onLogOnChain,
  txSignature,
}: AidDashboardProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Resource allocation</h2>
          <p className="text-sm text-slate-400">
            Predicted needs for {allocation ? allocation.crisisType : 'the most severe crisis'}
          </p>
        </div>
        {allocation ? (
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${priorityStyles[allocation.priority] ?? priorityStyles.medium}`}
          >
            {allocation.priority}
          </span>
        ) : null}
      </div>

      {isLoading || !allocation ? (
        <p className="text-sm text-slate-300">Estimating community needs…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: 'People affected', value: fmt(allocation.estimatedPeopleAffected) },
            { label: 'Water (L)', value: fmt(allocation.waterLiters) },
            { label: 'Meals', value: fmt(allocation.meals) },
            { label: 'Medical kits', value: fmt(allocation.medicalKits) },
            { label: 'Shelter kits', value: fmt(allocation.shelterKits) },
            { label: 'Hygiene kits', value: fmt(allocation.hygieneKits) },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-700 bg-slate-950/60 p-3"
            >
              <p className="text-lg font-semibold text-white">{item.value}</p>
              <p className="text-xs text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3">
        <button
          onClick={onLogOnChain}
          disabled={disabled || logging}
          className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          title={disabled ? 'Connect a wallet first' : 'Record this crisis on Solana'}
        >
          {logging ? 'Recording…' : 'Log Crisis On-Chain'}
        </button>

        {txSignature ? (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            On-chain receipt: <span className="font-mono">{txSignature}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}