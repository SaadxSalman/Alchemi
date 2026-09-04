import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { solana } from '../../services/solana';
import { CrisisModel } from '../../models/crisis';

export const solanaRouter = router({
  /** Cluster health — "ok" when a validator / RPC endpoint is reachable. */
  health: publicProcedure.query(async () => {
    try {
      const cluster = await solana.getHealth();
      return { online: true, cluster, programId: solana.programAddress };
    } catch {
      return {
        online: false,
        cluster: 'unreachable',
        programId: solana.programAddress,
      };
    }
  }),

  /**
   * Records a crisis on-chain via the aether-contracts Anchor program.
   * Without a running validator the service returns a simulated signature
   * so the whole stack remains testable offline.
   */
  reportCrisis: publicProcedure
    .input(
      z.object({
        crisisId: z.string().optional(),
        authority: z.string().min(32).max(64),
        crisisType: z.string().min(2),
        severity: z.number().min(0).max(1),
      })
    )
    .mutation(async ({ input }) => {
      const receipt = await solana.reportCrisis({
        authority: input.authority,
        crisisType: input.crisisType,
        severity: input.severity,
      });

      // Best-effort: persist the tx reference on the crisis record.
      let persisted = false;
      if (input.crisisId) {
        try {
          await CrisisModel.updateOne(
            { _id: input.crisisId },
            { $set: { solanaTx: receipt.signature ?? null } }
          );
          persisted = true;
        } catch {
          // Mongo offline — the receipt is still returned to the caller.
        }
      }

      return { ...receipt, persisted };
    }),
});