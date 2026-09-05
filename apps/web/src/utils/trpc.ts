import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@server/trpc/root";

export const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

/** Alchemi API key — sent as the `x-api-key` header on every tRPC request. */
export const API_KEY =
  process.env.NEXT_PUBLIC_ALCHEMI_API_KEY ?? "";

export const trpc = createTRPCReact<AppRouter>();

export type { AppRouter };
