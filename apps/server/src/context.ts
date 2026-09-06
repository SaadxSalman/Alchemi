/** tRPC context factory (Express adapter). */
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { env } from "./env";
import { verifyToken } from "./auth";
import type { User } from "./auth";

export interface Context {
  env: typeof env;
  apiKey?: string;
  user?: User;
}

function extractBearer(req: CreateExpressContextOptions["req"]): string | null {
  const header = req.headers["authorization"];
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return null;
}

export function createContext({ req }: CreateExpressContextOptions): Context {
  const token = extractBearer(req);
  const user = token ? verifyToken(token) : null;
  return {
    env,
    apiKey: (req.headers["x-api-key"] as string | undefined) ?? undefined,
    user: user ?? undefined,
  };
}
