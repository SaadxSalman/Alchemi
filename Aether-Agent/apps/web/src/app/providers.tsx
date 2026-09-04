'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc, API_BASE } from '../utils/trpc';

/**
 * Client-side providers: tRPC (typed RPC to the Node orchestrator) and
 * React Query (caching + polling for the "real-time" dashboard feel).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${API_BASE}/trpc`,
          // Include credentials so auth can be attached in tRPC context later.
          fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}