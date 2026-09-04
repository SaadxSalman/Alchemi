export declare const appRouter: import("@trpc/server").TRPCBuiltRouter<{
    ctx: {
        req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
        res: import("express").Response<any, Record<string, any>>;
        db: import("mongoose").Connection;
    };
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: false;
}, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
    monitor: import("@trpc/server").TRPCBuiltRouter<{
        ctx: {
            req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
            res: import("express").Response<any, Record<string, any>>;
            db: import("mongoose").Connection;
        };
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
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
    solana: import("@trpc/server").TRPCBuiltRouter<{
        ctx: {
            req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
            res: import("express").Response<any, Record<string, any>>;
            db: import("mongoose").Connection;
        };
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        health: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: {
                online: boolean;
                cluster: string;
                programId: string;
            };
            meta: object;
        }>;
        reportCrisis: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                authority: string;
                crisisType: string;
                severity: number;
                crisisId?: string | undefined;
            };
            output: {
                persisted: boolean;
                authority: string;
                crisisType: string;
                severity: number;
                timestamp: number;
                signature?: string;
            };
            meta: object;
        }>;
    }>>;
    allocation: import("@trpc/server").TRPCBuiltRouter<{
        ctx: {
            req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
            res: import("express").Response<any, Record<string, any>>;
            db: import("mongoose").Connection;
        };
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        estimateNeeds: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                crisisType: string;
                severity: number;
                affectedPopulation?: number | undefined;
            };
            output: {
                estimatedPeopleAffected: number;
                waterLiters: number;
                meals: number;
                medicalKits: number;
                shelterKits: number;
                hygieneKits: number;
                priority: "low" | "medium" | "high" | "critical";
                crisisType: string;
                severity: number;
            };
            meta: object;
        }>;
    }>>;
}>>;
export type AppRouter = typeof appRouter;
//# sourceMappingURL=_app.d.ts.map