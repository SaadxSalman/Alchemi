export declare const monitorRouter: import("@trpc/server").TRPCBuiltRouter<{
    ctx: {
        req: express.Request;
        res: express.Response;
        db: import("mongoose").Connection;
    };
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: false;
}, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
    getActiveCrises: import("@trpc/server").TRPCQueryProcedure<{
        input: void;
        output: {
            id: number;
            type: string;
            severity: string;
            location: string;
        }[];
        meta: object;
    }>;
    analyzeSatellite: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            imageUrl: string;
        };
        output: {
            status: string;
            taskId: string;
        };
        meta: object;
    }>;
}>>;
//# sourceMappingURL=monitor.d.ts.map