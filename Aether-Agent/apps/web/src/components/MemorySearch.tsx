'use client';

import { useState, type FormEvent } from 'react';
import { trpc } from '../hooks/useTRPC';

/**
 * Multi-modal memory search — finds past crises similar to a free-text
 * query via the Milvus embedding space (falls back to MongoDB text search).
 */
export function MemorySearch() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');

  const search = trpc.monitor.searchSimilar.useQuery(
    { query: submitted, limit: 5 },
    { enabled: submitted.length >= 2 }
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(query.trim());
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="mb-1 text-xl font-semibold">Multi-modal memory</h2>
      <p className="mb-4 text-sm text-slate-400">
        Search the embedding space of past satellite analyses and reports.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="e.g. flood damage reports"
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500"
        />
        <button
          type="submit"
          className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
        >
          Search
        </button>
      </form>

      {search.isFetching ? (
        <p className="mt-4 text-sm text-slate-300">Searching embedding space…</p>
      ) : null}

      {search.data ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            matched via {search.data.source}
          </p>
          {search.data.results.length === 0 ? (
            <p className="text-sm text-slate-400">No similar crises stored yet.</p>
          ) : (
            search.data.results.map((match) => (
              <div
                key={`${match.id}-${match.distance}`}
                className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-100">{match.crisisType}</span>
                <span className="text-slate-400">
                  {match.source} · distance {match.distance.toFixed(3)}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}