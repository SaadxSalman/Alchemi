/** tRPC context factory (Express adapter). */
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { env } from "./env";

export interface Context {
  env: typeof env;
  apiKey?: string;
}

export function createContext({ req }: CreateExpressContextOptions): Context {
  return {
    env,
    apiKey: (req.headers["x-api-key"] as string | undefined) ?? undefined,
  };
}
