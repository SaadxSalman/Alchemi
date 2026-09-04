export declare const monitorRouter: import("@trpc/server").TRPCBuiltRouter<{
    ctx: {
        req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
        res: import("express").Response<any, Record<string, any>>;
        db: import("mongoose").Connection;
    };
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: false;
}, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
    /** Monitoring Agent — live feed of active crises. */
    getActiveCrises: import("@trpc/server").TRPCQueryProcedure<{
        input: void;
        output: {
            id: string;
            type: any;
            severity: number;
            location: any;
            status: any;
            confidence: number;
        }[];
        meta: object;
    }>;
    /** Dashboard summary counters. */
    getStats: import("@trpc/server").TRPCQueryProcedure<{
        input: void;
        output: {
            active: number;
            critical: number;
            mostCommonType: string;
            source: "mongodb";
        } | {
            active: number;
            critical: number;
            mostCommonType: string;
            source: "fallback";
        };
        meta: object;
    }>;
    /** Satellite Vision pipeline — analyze an image and flag a crisis. */
    analyzeSatellite: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            imageUrl: string;
        };
        output: {
            id: string;
            type: any;
            severity: any;
            confidence: number;
            status: any;
            location: any;
            message: string;
            similar: import("../../services/milvus").SimilarMatch[];
            vectorMemory: boolean;
        };
        meta: object;
    }>;
    /** Multi-modal similarity search — "find past crises like this". */
    searchSimilar: import("@trpc/server").TRPCQueryProcedure<{
        input: {
            query: string;
            limit?: number | undefined;
        };
        output: {
            source: "milvus";
            results: import("../../services/milvus").SimilarMatch[];
        } | {
            source: "mongodb";
            results: {
                id: string;
                distance: number;
                crisisType: string;
                source: string;
            }[];
        } | {
            source: "none";
            results: never[];
        };
        meta: object;
    }>;
}>>;
//# sourceMappingURL=monitor.d.ts.map