export declare const router: import("@trpc/server").TRPCRouterBuilder<{
    ctx: {
        req: express.Request;
        res: express.Response;
        db: import("mongoose").Connection;
    };
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: false;
}>;
export declare const publicProcedure: import("@trpc/server").TRPCProcedureBuilder<{
    req: express.Request;
    res: express.Response;
    db: import("mongoose").Connection;
}, object, object, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, false>;
//# sourceMappingURL=trpc.d.ts.map