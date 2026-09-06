/**
 * Alchemi orchestration server (Express + tRPC + MongoDB + Redis).
 * Production hardening: Helmet, rate limiting, Pino, graceful shutdown.
 */
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { connectDatabase, dbStatus, disconnectDatabase } from "./db";
import { env } from "./env";
import { logger } from "./logger";
import { createContext } from "./context";
import { appRouter } from "./trpc/root";
import { connectCache, disconnectCache, cache } from "./cache";
import { initQueue, closeQueue, isQueueAvailable } from "./queue";
import { getUserCount } from "./auth";
import { pythonBridge } from "./services/pythonBridge";

const app = express();

// Security & hardening.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Request-ID middleware for tracing.
app.use((req, _res, next) => {
  const id = (req.headers["x-request-id"] as string) || crypto.randomUUID();
  (req as any).requestId = id;
  next();
});

// Rate limiting — 100 req/min per IP on tRPC.
const limiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down" },
  skip: () => env.nodeEnv === "test",
});

// ── REST utilities ───────────────────────────────────────────────────────────
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
    queue: isQueueAvailable(),
    cache: cache.isConnected(),
    uptime: process.uptime(),
    time: new Date().toISOString(),
  });
});

app.get("/rest/metrics", (_req, res) => {
  res.json({
    uptimeSeconds: Math.round(process.uptime()),
    memory: process.memoryUsage(),
    db: dbStatus(),
    cache: cache.isConnected(),
    queue: isQueueAvailable(),
    users: getUserCount(),
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

  // Check cache first.
  const cacheKey = `${smiles}:${width}x${height}`;
  const cached = await cache.get<{ svg: string }>(cacheKey, "render");
  if (cached) {
    res.type("image/svg+xml").set("X-Cache", "HIT").send(cached.svg);
    return;
  }

  try {
    const { svg } = await pythonBridge.render(smiles, width, height);
    await cache.set(cacheKey, { svg }, "render", 600);
    res.type("image/svg+xml").set("X-Cache", "MISS").send(svg);
  } catch (err) {
    logger.warn({ err, smiles }, "Render failed");
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

// ── tRPC API ─────────────────────────────────────────────────────────────────
app.use(
  "/trpc",
  limiter,
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, path }) {
      logger.error({ err: error, path }, "tRPC error");
    },
  })
);

app.use((_req, res) => {
  res.status(404).json({ error: "not found", hint: "tRPC lives at /trpc, health at /rest/health" });
});

// ── Startup ──────────────────────────────────────────────────────────────────
let server: ReturnType<typeof app.listen> | null = null;

async function main() {
  await connectDatabase();
  await connectCache();
  await initQueue();

  server = app.listen(env.port, () => {
    logger.info(`[alchemi-server] listening on http://localhost:${env.port}`);
    logger.info(`  tRPC    → http://localhost:${env.port}/trpc`);
    logger.info(`  health  → http://localhost:${env.port}/rest/health`);
    logger.info(`  metrics → http://localhost:${env.port}/rest/metrics`);
    logger.info(`  AI bridge → ${env.aiEngineUrl}`);
    logger.info(`  env file  → ${env.loadedFrom ?? "(none — defaults)"}`);
    logger.info(`  API key   → ${env.apiKey ? `ENABLED (${env.apiKey.length} chars)` : "DISABLED (open)"}`);
    logger.info(`  queue     → ${isQueueAvailable() ? "BullMQ (async)" : "sync fallback"}`);
    logger.info(`  cache     → ${cache.isConnected() ? "Redis" : "no-op fallback"}`);
  });
}

// ── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  logger.info({ signal }, "Shutdown signal received — draining...");
  try {
    if (server) server.close();
    await closeQueue();
    await disconnectCache();
    await disconnectDatabase();
    logger.info("Graceful shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

main().catch((err) => {
  logger.fatal({ err }, "Fatal startup error");
  process.exit(1);
});
