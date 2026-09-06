/**
 * BullMQ job queue — turns long-running LLM-powered agent calls into
 * background jobs so the HTTP layer stays responsive.
 */
import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { randomUUID } from "crypto";
import { env } from "./env";
import { logger } from "./logger";
import { pythonBridge } from "./services/pythonBridge";
import { runRepo } from "./repositories/runRepo";

export type AgentJobName = "molecule-design" | "reaction-prediction" | "simulation";

export interface AgentJobResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

interface JobRecord {
  id: string;
  agent: AgentJobName;
  status: "queued" | "active" | "completed" | "failed";
  progress: number;
  result?: AgentJobResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const JOB_TTL_MS = 30 * 60 * 1000;
const memoryJobs = new Map<string, JobRecord>();
let queue: Queue | null = null;
let worker: Worker | null = null;
let redisAvailable = false;

const conn: ConnectionOptions = { url: env.redisUrl, maxRetriesPerRequest: null };

function updateJob(id: string, patch: Partial<JobRecord>): void {
  const existing = memoryJobs.get(id);
  if (!existing) return;
  memoryJobs.set(id, { ...existing, ...patch, updatedAt: new Date().toISOString() });
}

async function runSyncJob(jobId: string, agent: AgentJobName, payload: Record<string, unknown>): Promise<void> {
  try {
    let data: Record<string, unknown>;
    switch (agent) {
      case "molecule-design":
        data = (await pythonBridge.design(payload)) as Record<string, unknown>;
        break;
      case "reaction-prediction":
        data = (await pythonBridge.pathway(payload)) as Record<string, unknown>;
        break;
      case "simulation":
        data = (await pythonBridge.simulate(payload)) as Record<string, unknown>;
        break;
    }
    await runRepo.record({
      agent,
      input: payload,
      summary: (data.summary as string) ?? (data.narrative as string) ?? "",
      resultPreview: { valid: data.valid ?? true },
    });
    updateJob(jobId, { status: "completed", progress: 100, result: { ok: true, data } });
  } catch (err) {
    updateJob(jobId, { status: "failed", error: err instanceof Error ? err.message : String(err) });
  }
}

export async function initQueue(): Promise<boolean> {
  try {
    queue = new Queue("alchemi-agents", {
      connection: conn,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 24 * 3600 },
      },
    });
    queue.on("error", () => {});

    worker = new Worker(
      "alchemi-agents",
      async (job) => {
        const { agent, payload, jobId } = job.data as {
          agent: AgentJobName;
          payload: Record<string, unknown>;
          jobId: string;
        };
        updateJob(jobId, { status: "active", progress: 10 });
        let data: Record<string, unknown>;
        const t0 = Date.now();
        switch (agent) {
          case "molecule-design":
            updateJob(jobId, { progress: 30 });
            data = (await pythonBridge.design(payload)) as Record<string, unknown>;
            break;
          case "reaction-prediction":
            updateJob(jobId, { progress: 30 });
            data = (await pythonBridge.pathway(payload)) as Record<string, unknown>;
            break;
          case "simulation":
            updateJob(jobId, { progress: 30 });
            data = (await pythonBridge.simulate(payload)) as Record<string, unknown>;
            break;
          default:
            throw new Error(`Unknown agent: ${agent}`);
        }
        try {
          await runRepo.record({
            agent,
            input: payload,
            summary: (data.summary as string) ?? (data.narrative as string) ?? "",
            resultPreview: agent === "molecule-design"
              ? { count: (data.candidates as unknown[])?.length ?? 0 }
              : { valid: data.valid },
          });
        } catch (err) {
          logger.warn({ err, jobId }, "Failed to persist run record");
        }
        updateJob(jobId, { status: "completed", progress: 100, result: { ok: true, data } });
        logger.info({ agent, jobId, durationMs: Date.now() - t0 }, "Job completed");
        return data;
      },
      { connection: conn, concurrency: 2 }
    );
    worker.on("error", () => {});

    worker.on("failed", (job, err) => {
      const jobId = job?.data?.jobId as string | undefined;
      if (jobId) updateJob(jobId, { status: "failed", error: err.message });
      logger.error({ err: err.message, jobId, agent: job?.data?.agent }, "Job failed");
    });

    await queue.waitUntilReady();
    await worker.waitUntilReady();
    redisAvailable = true;
    logger.info("BullMQ worker ready — async agent jobs enabled");
    return true;
  } catch (err) {
    redisAvailable = false;
    queue = null;
    worker = null;
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Redis unavailable — falling back to synchronous agent execution"
    );
    return false;
  }
}

export async function closeQueue(): Promise<void> {
  if (worker) await worker.close().catch(() => {});
  if (queue) await queue.close().catch(() => {});
  worker = null;
  queue = null;
  redisAvailable = false;
}

export interface EnqueueResult {
  jobId: string;
  queued: boolean;
}

export async function enqueueAgentJob(
  agent: AgentJobName,
  payload: Record<string, unknown>
): Promise<EnqueueResult> {
  const jobId = randomUUID();
  if (redisAvailable && queue) {
    memoryJobs.set(jobId, {
      id: jobId,
      agent,
      status: "queued",
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await queue.add("run", { agent, payload, jobId });
    return { jobId, queued: true };
  }
  memoryJobs.set(jobId, {
    id: jobId,
    agent,
    status: "active",
    progress: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  runSyncJob(jobId, agent, payload);
  return { jobId, queued: false };
}

export function getJob(jobId: string): JobRecord | null {
  return memoryJobs.get(jobId) ?? null;
}

export function isQueueAvailable(): boolean {
  return redisAvailable;
}

setInterval(() => {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of memoryJobs) {
    if (job.status === "completed" || job.status === "failed") {
      if (new Date(job.updatedAt).getTime() < cutoff) memoryJobs.delete(id);
    }
  }
}, 60_000).unref();