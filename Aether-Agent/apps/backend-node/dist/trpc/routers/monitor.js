"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitorRouter = void 0;
const zod_1 = require("zod");
const trpc_1 = require("../trpc");
exports.monitorRouter = (0, trpc_1.router)({
    getActiveCrises: trpc_1.publicProcedure.query(async () => {
        // In the future, this calls Milvus/MongoDB
        return [
            { id: 1, type: 'Flood', severity: 'High', location: 'Region A' },
            { id: 2, type: 'Wildfire', severity: 'Medium', location: 'Region B' },
        ];
    }),
    analyzeSatellite: trpc_1.publicProcedure
        .input(zod_1.z.object({ imageUrl: zod_1.z.string().url() }))
        .mutation(async ({ input }) => {
        // Logic to trigger your Rust-core Vision Transformer
        return { status: "processing", taskId: "abc-123" };
    }),
});
// Inside analyzeSatellite mutation
const response = await fetch('http://localhost:50051/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: input.imageUrl }),
});
const result = await response.json();
// Update MongoDB with the findings
await CrisisModel.create({
    type: result.crisis_type,
    severity: result.severity,
    timestamp: new Date(),
});
//# sourceMappingURL=monitor.js.map