'use client';

import { useEffect, useState } from 'react';
import { API_BASE, trpc } from '../utils/trpc';

export { trpc };

/**
 * Lightweight backend liveness check (REST /health on the orchestrator).
 * Powers the dashboard status badge; polls so reconnects are noticed.
 */
export function useBackendHealth(pollMs = 30000) {
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`);
        if (!cancelled) setHealthy(res.ok);
      } catch {
        if (!cancelled) setHealthy(false);
      }
    };
    void check();
    const timer = setInterval(check, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pollMs]);

  return healthy;
}