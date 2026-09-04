import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
/**
 * tRPC context factory — built for every request.
 * In the future we attach auth info here (user sessions etc).
 */
export declare function createContext({ req, res }: CreateExpressContextOptions): {
    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
    res: import("express").Response<any, Record<string, any>>;
    db: import("mongoose").Connection;
};
export type Context = inferAsyncReturnType<typeof createContext>;
//# sourceMappingURL=context.d.ts.map