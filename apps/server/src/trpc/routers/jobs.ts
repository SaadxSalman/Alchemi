/** Jobs router — poll async agent job status and result. */
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { getJob } from "../../queue";

export const jobsRouter = router({
  get: protectedProcedure
    .input(z.object({ jobId: z.string().min(1) }))
    .query(({ input }) => {
      const job = getJob(input.jobId);
      if (!job) {
        return { found: false, job: null };
      }
      return { found: true, job };
    }),
});
