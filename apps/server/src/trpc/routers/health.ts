/** Health router — aggregates status of server, DB and AI engine. */
import { z } from "zod";
import { dbStatus } from "../../db";
import { pythonBridge } from "../../services/pythonBridge";
import { publicProcedure, router } from "../trpc";

export const healthRouter = router({
  check: publicProcedure
    .input(z.void().optional())
    .query(async () => {
      const db = dbStatus();
      let ai: Record<string, unknown> = { ok: false, error: "unchecked" };
      try {
        const h = await pythonBridge.health();
        ai = { ok: true, ...h };
      } catch (err) {
        ai = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
      return {
        server: "ok" as const,
        version: "1.0.0",
        db: { mode: db.mode, connected: db.connected, error: db.lastError },
        ai,
        time: new Date().toISOString(),
      };
    }),
});
