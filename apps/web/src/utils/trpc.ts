import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@server/trpc/root";

export const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

export const trpc = createTRPCReact<AppRouter>();

export type { AppRouter };
