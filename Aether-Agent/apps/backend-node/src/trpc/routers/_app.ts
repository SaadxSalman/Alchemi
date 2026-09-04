import { router } from '../trpc';
import { monitorRouter } from './monitor';
import { solanaRouter } from './solana';
import { allocationRouter } from './allocation';

export const appRouter = router({
  monitor: monitorRouter,
  solana: solanaRouter,
  allocation: allocationRouter,
});

export type AppRouter = typeof appRouter;