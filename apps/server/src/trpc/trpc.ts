/** tRPC primitives: router, public/protected procedures, error formatting. */
import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import type { Context } from "../context";

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * When ALCHEMI_API_KEY is configured, mutating procedures must present it
 * via the `x-api-key` header. Unset (default dev) → open access.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.env.apiKey) return next();
  if (ctx.apiKey !== ctx.env.apiKey) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Missing or invalid x-api-key header",
    });
  }
  return next();
});

/**
 * Requires a valid JWT Bearer token. Attaches ctx.user.
 * Use for user-specific operations (my runs, my molecules, profile).
 */
export const authenticatedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required — provide a Bearer token",
    });
  }
  return next();
});
