/**
 * Alchemi orchestration server (Express + tRPC + MongoDB).
 *
 *   /trpc/*          — end-to-end type-safe API consumed by the Next.js app
 *   /rest/health     — plain-JSON health probe (curl-friendly)
 *   /rest/render     — server-side RDKit structure rendering (SVG proxy)
 */
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cors from "cors";
import express from "express";
import { connectDatabase, dbStatus } from "./db";
import { env } from "./env";
import { pythonBridge } from "./services/pythonBridge";
import { appRouter } from "./trpc/root";
import { createContext } from "./context";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ── REST utilities (curl / <img> friendly) ──────────────────────────────────
app.get("/rest/health", async (_req, res) => {
  const db = dbStatus();
  let ai: Record<string, unknown> = { ok: false, error: "unchecked" };
  try {
    ai = { ok: true, ...(await pythonBridge.health()) };
  } catch (err) {
    ai = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  res.json({
    server: "ok",
    version: "1.0.0",
    db: { mode: db.mode, connected: db.connected, error: db.lastError },
    ai,
    time: new Date().toISOString(),
  });
});

app.get("/rest/render", async (req, res) => {
  const smiles = String(req.query.smiles ?? "");
  const width = Math.min(Number(req.query.w ?? 420) || 420, 1200);
  const height = Math.min(Number(req.query.h ?? 320) || 320, 1200);
  if (!smiles) {
    res.status(400).type("text/plain").send("missing ?smiles=");
    return;
  }
  try {
    const { svg } = await pythonBridge.render(smiles, width, height);
    res.type("image/svg+xml").send(svg);
  } catch (err) {
    res
      .status(503)
      .type("image/svg+xml")
      .send(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
          `<rect width="100%" height="100%" fill="#1e293b"/>` +
          `<text x="50%" y="50%" fill="#94a3b8" font-family="monospace" font-size="12" ` +
          `text-anchor="middle" dominant-baseline="middle">render unavailable</text></svg>`
      );
  }
});

// ── tRPC API ────────────────────────────────────────────────────────────────
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, path }) {
      console.error(`[tRPC] ${path}: ${error.code} — ${error.message}`);
    },
  })
);

app.use((_req, res) => {
  res.status(404).json({ error: "not found", hint: "tRPC lives at /trpc, health at /rest/health" });
});

async function main() {
  await connectDatabase();
  app.listen(env.port, () => {
    console.log(`[alchemi-server] listening on http://localhost:${env.port}`);
    console.log(`  tRPC   → http://localhost:${env.port}/trpc`);
    console.log(`  health → http://localhost:${env.port}/rest/health`);
    console.log(`  AI bridge → ${env.aiEngineUrl}`);
    console.log(`  env file  → ${env.loadedFrom ?? "(none found — defaults in use)"}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
