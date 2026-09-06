/**
 * Redis caching layer (ioredis) with graceful no-op fallback.
 *
 * When Redis is unreachable, every cache operation silently degrades:
 *   get()  → undefined  (caller recomputes)
 *   set()  → no-op
 *   del()  → no-op
 * This lets the full stack run on a laptop with zero infra, while gaining
 * real speed-ups (rendered SVGs, validation results) where Redis is present.
 */
import IORedis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

let redis: IORedis | null = null;
let connected = false;

export async function connectCache(): Promise<boolean> {
  try {
    redis = new IORedis(env.redisUrl, {
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    // Suppress unhandled error events — connection failures are caught below.
    redis.on("error", () => {});
    await Promise.race([
      redis.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Redis connection timeout")), 2000)
      ),
    ]);
    connected = true;
    logger.info({ redisUrl: env.redisUrl.replace(/\/\/.*@/, "//<redacted>@") }, "Redis connected");
    return true;
  } catch (err) {
    connected = false;
    redis = null;
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Redis unavailable — caching disabled (no-op fallback)"
    );
    return false;
  }
}

export async function disconnectCache(): Promise<void> {
  if (redis) {
    await redis.quit().catch(() => {});
    redis = null;
    connected = false;
  }
}

/** Serializes values as JSON for storage. Prefix avoids key collisions. */
function ns(key: string, nsName: string): string {
  return `alchemi:${nsName}:${key}`;
}

export const cache = {
  async get<T = unknown>(key: string, namespace = "default"): Promise<T | undefined> {
    if (!connected || !redis) return undefined;
    try {
      const raw = await redis.get(ns(key, namespace));
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  },

  /** ttlSeconds defaults to 5 minutes. Pass 0 to persist. */
  async set(key: string, value: unknown, namespace = "default", ttlSeconds = 300): Promise<void> {
    if (!connected || !redis) return;
    try {
      const raw = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await redis.set(ns(key, namespace), raw, "EX", ttlSeconds);
      } else {
        await redis.set(ns(key, namespace), raw);
      }
    } catch {
      /* no-op */
    }
  },

  async del(key: string, namespace = "default"): Promise<void> {
    if (!connected || !redis) return;
    try {
      await redis.del(ns(key, namespace));
    } catch {
      /* no-op */
    }
  },

  /** Deletes every key matching a namespace prefix (e.g. clear all renders). */
  async clearNamespace(namespace: string): Promise<void> {
    if (!connected || !redis) return;
    try {
      const keys = await redis.keys(ns("*", namespace));
      if (keys.length) await redis.del(...keys);
    } catch {
      /* no-op */
    }
  },

  isConnected(): boolean {
    return connected;
  },
};
