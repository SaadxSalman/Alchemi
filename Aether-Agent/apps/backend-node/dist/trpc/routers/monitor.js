"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitorRouter = void 0;
const zod_1 = require("zod");
const trpc_1 = require("../trpc");
const crisis_1 = require("../../models/crisis");
const rustCore_1 = require("../../services/rustCore");
const milvus_1 = require("../../services/milvus");
const embeddings_1 = require("../../services/embeddings");
const fallbackCrises = [
    {
        id: 'seed-1',
        type: 'Flood',
        severity: 0.91,
        location: 'Lahore, Pakistan',
        status: 'response-active',
        confidence: 0.94,
    },
    {
        id: 'seed-2',
        type: 'Wildfire',
        severity: 0.72,
        location: 'Northern California, USA',
        status: 'monitoring',
        confidence: 0.81,
    },
    {
        id: 'seed-3',
        type: 'Earthquake',
        severity: 0.83,
        location: 'Kahramanmaraş, Türkiye',
        status: 'detected',
        confidence: 0.88,
    },
];
exports.monitorRouter = (0, trpc_1.router)({
    /** Monitoring Agent — live feed of active crises. */
    getActiveCrises: trpc_1.publicProcedure.query(async () => {
        try {
            const crises = await crisis_1.CrisisModel.find({ active: true })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();
            if (crises.length > 0) {
                return crises.map((crisis) => ({
                    id: String(crisis._id),
                    type: crisis.type,
                    severity: Number(crisis.severity ?? 0.5),
                    location: crisis.location?.region ??
                        crisis.location?.country ??
                        'Unknown location',
                    status: crisis.status ?? 'detected',
                    confidence: 0.8,
                }));
            }
        }
        catch (error) {
            console.warn('MongoDB is unavailable; returning seeded crisis data.', error);
        }
        return fallbackCrises;
    }),
    /** Dashboard summary counters. */
    getStats: trpc_1.publicProcedure.query(async () => {
        try {
            const [active, critical, byType] = await Promise.all([
                crisis_1.CrisisModel.countDocuments({ active: true }),
                crisis_1.CrisisModel.countDocuments({ active: true, severity: { $gte: 0.75 } }),
                crisis_1.CrisisModel.aggregate([
                    { $group: { _id: '$type', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                ]),
            ]);
            return {
                active,
                critical,
                mostCommonType: byType[0]?._id ?? 'None',
                source: 'mongodb',
            };
        }
        catch {
            // MongoDB offline — derive stats from the seeded sample instead.
            return {
                active: fallbackCrises.length,
                critical: fallbackCrises.filter((c) => c.severity >= 0.75).length,
                mostCommonType: 'Flood',
                source: 'fallback',
            };
        }
    }),
    /** Satellite Vision pipeline — analyze an image and flag a crisis. */
    analyzeSatellite: trpc_1.publicProcedure
        .input(zod_1.z.object({ imageUrl: zod_1.z.string().url() }))
        .mutation(async ({ input }) => {
        const result = await (0, rustCore_1.analyzeSatelliteImage)(input.imageUrl);
        // Multi-modal memory — best-effort, never blocks the response.
        const textVector = (0, embeddings_1.embedText)(`satellite analysis ${result.crisis_type} severity ${result.severity}`);
        const imageVector = (0, embeddings_1.embedImage)(input.imageUrl, result.crisis_type);
        let similar = [];
        try {
            await milvus_1.milvus.insert({
                imageVector,
                textVector,
                crisisType: result.crisis_type,
                source: 'satellite',
            });
            similar = await milvus_1.milvus.searchText(textVector, 3);
        }
        catch {
            // Milvus offline — vector memory unavailable for this analysis.
        }
        try {
            const crisis = await crisis_1.CrisisModel.create({
                type: result.crisis_type,
                severity: Number(result.severity),
                crisisLabel: result.crisis_type,
                description: `Detected using satellite image analysis with ${result.confidence ?? 0.8} confidence.`,
                imageUrl: input.imageUrl,
                source: 'satellite',
                status: 'monitoring',
                active: true,
            });
            return {
                id: String(crisis._id),
                type: crisis.type,
                severity: crisis.severity,
                confidence: result.confidence ?? 0.8,
                status: crisis.status,
                location: crisis.location?.region ?? 'Auto-detected',
                message: `Crisis ${crisis.type} flagged successfully.`,
                similar,
                vectorMemory: similar.length > 0,
            };
        }
        catch (error) {
            console.warn('MongoDB unavailable while saving crisis analysis.', error);
            return {
                id: 'mock-' + Date.now(),
                type: result.crisis_type,
                severity: Number(result.severity),
                confidence: result.confidence ?? 0.8,
                status: 'monitoring',
                location: 'Auto-detected',
                message: 'Crisis analysis completed without database persistence.',
                similar,
                vectorMemory: similar.length > 0,
            };
        }
    }),
    /** Multi-modal similarity search — "find past crises like this". */
    searchSimilar: trpc_1.publicProcedure
        .input(zod_1.z.object({
        query: zod_1.z.string().min(2),
        limit: zod_1.z.number().int().min(1).max(20).default(5),
    }))
        .query(async ({ input }) => {
        const vector = (0, embeddings_1.embedText)(input.query);
        try {
            const results = await milvus_1.milvus.searchText(vector, input.limit);
            return { source: 'milvus', results };
        }
        catch {
            // Milvus offline — degrade to a text search over MongoDB.
            try {
                const escaped = input.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escaped, 'i');
                const docs = await crisis_1.CrisisModel.find({
                    $or: [
                        { description: regex },
                        { type: regex },
                        { crisisLabel: regex },
                    ],
                })
                    .limit(input.limit)
                    .lean();
                return {
                    source: 'mongodb',
                    results: docs.map((doc, i) => ({
                        id: String(doc._id),
                        distance: i,
                        crisisType: String(doc.type ?? 'Unknown'),
                        source: String(doc.source ?? 'unknown'),
                    })),
                };
            }
            catch {
                return { source: 'none', results: [] };
            }
        }
    }),
});
//# sourceMappingURL=monitor.js.map