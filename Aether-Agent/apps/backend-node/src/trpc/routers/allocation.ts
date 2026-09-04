import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { estimateAidPackage } from '../../services/allocation';

export const allocationRouter = router({
  /**
   * Resource Allocation Agent — predicts the needs of an affected community
   * for a given crisis type + severity. Pure function, no side effects.
   */
  estimateNeeds: publicProcedure
    .input(
      z.object({
        crisisType: z.string().min(2),
        severity: z.number().min(0).max(1),
        affectedPopulation: z.number().int().positive().optional(),
      })
    )
    .query(({ input }) => ({
      crisisType: input.crisisType,
      severity: input.severity,
      ...estimateAidPackage(
        input.crisisType,
        input.severity,
        input.affectedPopulation
      ),
    })),
});