/**
 * Environment loading for the Alchemi orchestration server.
 *
 * Secrets live in `venv/.env` (git-ignored). Search order:
 *   1. <repo>/venv/.env        ← recommended (kept out of GitHub)
 *   2. apps/server/.env
 *   3. <repo>/.env
 * An explicit ALCHEMI_ENV_FILE overrides everything.
 */
import dotenv from "dotenv";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const SERVER_ROOT = path.resolve(__dirname, "..");

function loadFirstEnvFile(): string | null {
  const override = process.env.ALCHEMI_ENV_FILE;
  const candidates = override
    ? [override]
    : [
        path.join(REPO_ROOT, "venv", ".env"),
        path.join(SERVER_ROOT, ".env"),
        path.join(REPO_ROOT, ".env"),
      ];
  for (const file of candidates) {
    if (dotenv.config({ path: file }).error === undefined) {
      return file;
    }
  }
  return null;
}

const loadedFrom = loadFirstEnvFile();

function int(key: string, fallback: number): number {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const env = {
  loadedFrom,
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: int("PORT", 4000),
  mongodbUri: process.env.MONGODB_URI?.trim() ?? "",
  aiEngineUrl: process.env.AI_ENGINE_URL?.trim() || "http://localhost:8000",
  apiKey: process.env.ALCHEMI_API_KEY?.trim() ?? "",
  aiEngineTimeoutMs: int("AI_ENGINE_TIMEOUT_MS", 180_000),
};

export type Env = typeof env;
