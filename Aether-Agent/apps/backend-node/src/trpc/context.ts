import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { db } from '../services/db';

/**
 * tRPC context factory — built for every request.
 * In the future we attach auth info here (user sessions etc).
 */
export function createContext({ req, res }: CreateExpressContextOptions) {
  return {
    req,
    res,
    db,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;