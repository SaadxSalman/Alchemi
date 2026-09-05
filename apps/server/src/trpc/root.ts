/** Root tRPC router — the complete typed API surface. */
import { agentsRouter } from "./routers/agents";
import { healthRouter } from "./routers/health";
import { moleculesRouter } from "./routers/molecules";
import { runsRouter } from "./routers/runs";
import { router } from "./trpc";

export const appRouter = router({
  health: healthRouter,
  molecules: moleculesRouter,
  agents: agentsRouter,
  runs: runsRouter,
});

export type AppRouter = typeof appRouter;
