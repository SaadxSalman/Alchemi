import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../backend-node/src/trpc/routers/_app';

export const trpc = createTRPCReact<AppRouter>();

/** Base URL of the Node orchestrator (override with NEXT_PUBLIC_API_URL). */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';