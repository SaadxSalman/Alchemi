/** Runs router — agent activity history + dashboard statistics. */
import { z } from "zod";
import { runRepo } from "../../repositories/runRepo";
import { publicProcedure, router } from "../trpc";

export const runsRouter = router({
  list: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional())
    .query(({ input }) => runRepo.list(input?.limit ?? 20)),

  stats: publicProcedure.input(z.void().optional()).query(async () => {
    const runs = await runRepo.stats();
    return runs;
  }),
});
