import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
/**
 * tRPC context factory — built for every request.
 * In the future we attach auth info here (user sessions etc).
 */
export declare function createContext({ req, res }: CreateExpressContextOptions): {
    req: express.Request;
    res: express.Response;
    db: import("mongoose").Connection;
};
export type Context = inferAsyncReturnType<typeof createContext>;
//# sourceMappingURL=context.d.ts.map