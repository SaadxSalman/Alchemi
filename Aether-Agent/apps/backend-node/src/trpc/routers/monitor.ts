import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { CrisisModel } from '../../models/crisis';
import { analyzeSatelliteImage } from '../../services/rustCore';
import { milvus } from '../../services/milvus';
import { embedImage, embedText } from '../../services/embeddings';

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

export const monitorRouter = router({
  /** Monitoring Agent — live feed of active crises. */
  getActiveCrises: publicProcedure.query(async () => {
    try {
      const crises = await CrisisModel.find({ active: true })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      if (crises.length > 0) {
        return crises.map((crisis) => ({
          id: String(crisis._id),
          type: crisis.type,
          severity: Number(crisis.severity ?? 0.5),
          location:
            crisis.location?.region ??
            crisis.location?.country ??
            'Unknown location',
          status: crisis.status ?? 'detected',
          confidence: 0.8,
        }));
      }
    } catch (error) {
      console.warn('MongoDB is unavailable; returning seeded crisis data.', error);
    }

    return fallbackCrises;
  }),

  /** Dashboard summary counters. */
  getStats: publicProcedure.query(async () => {
    try {
      const [active, critical, byType] = await Promise.all([
        CrisisModel.countDocuments({ active: true }),
        CrisisModel.countDocuments({ active: true, severity: { $gte: 0.75 } }),
        CrisisModel.aggregate<{ _id: string; count: number }>([
          { $group: { _id: '$type', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
      ]);

      return {
        active,
        critical,
        mostCommonType: (byType[0]?._id as string) ?? 'None',
        source: 'mongodb' as const,
      };
    } catch {
      // MongoDB offline — derive stats from the seeded sample instead.
      return {
        active: fallbackCrises.length,
        critical: fallbackCrises.filter((c) => c.severity >= 0.75).length,
        mostCommonType: 'Flood',
        source: 'fallback' as const,
      };
    }
  }),

  /** Satellite Vision pipeline — analyze an image and flag a crisis. */
  analyzeSatellite: publicProcedure
    .input(z.object({ imageUrl: z.string().url() }))
    .mutation(async ({ input }) => {
      const result = await analyzeSatelliteImage(input.imageUrl);

      // Multi-modal memory — best-effort, never blocks the response.
      const textVector = embedText(
        `satellite analysis ${result.crisis_type} severity ${result.severity}`
      );
      const imageVector = embedImage(input.imageUrl, result.crisis_type);
      let similar: Awaited<ReturnType<typeof milvus.searchText>> = [];
      try {
        await milvus.insert({
          imageVector,
          textVector,
          crisisType: result.crisis_type,
          source: 'satellite',
        });
        similar = await milvus.searchText(textVector, 3);
      } catch {
        // Milvus offline — vector memory unavailable for this analysis.
      }

      try {
        const crisis = await CrisisModel.create({
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
      } catch (error) {
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
  searchSimilar: publicProcedure
    .input(
      z.object({
        query: z.string().min(2),
        limit: z.number().int().min(1).max(20).default(5),
      })
    )
    .query(async ({ input }) => {
      const vector = embedText(input.query);

      try {
        const results = await milvus.searchText(vector, input.limit);
        return { source: 'milvus' as const, results };
      } catch {
        // Milvus offline — degrade to a text search over MongoDB.
        try {
          const escaped = input.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escaped, 'i');
          const docs = await CrisisModel.find({
            $or: [
              { description: regex },
              { type: regex },
              { crisisLabel: regex },
            ],
          })
            .limit(input.limit)
            .lean();

          return {
            source: 'mongodb' as const,
            results: docs.map((doc, i) => ({
              id: String(doc._id),
              distance: i,
              crisisType: String(doc.type ?? 'Unknown'),
              source: String(doc.source ?? 'unknown'),
            })),
          };
        } catch {
          return { source: 'none' as const, results: [] };
        }
      }
    }),
});