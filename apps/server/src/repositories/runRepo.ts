/**
 * Agent-run repository — MongoDB with in-memory fallback (same interface).
 */
import { randomUUID } from "crypto";
import { dbStatus } from "../db";
import { DesignRunModel } from "../models/DesignRun";

export type AgentName = "molecule-design" | "reaction-prediction" | "simulation";

export interface RunDoc {
  id: string;
  agent: AgentName;
  input: Record<string, unknown>;
  summary: string;
  resultPreview: Record<string, unknown>;
  createdAt: string;
}

const memory = new Map<string, RunDoc>();

function toDoc(x: any): RunDoc {
  return {
    id: String(x.id ?? x._id),
    agent: x.agent,
    input: x.input ?? {},
    summary: x.summary ?? "",
    resultPreview: x.resultPreview ?? {},
    createdAt: x.createdAt ? new Date(x.createdAt).toISOString() : new Date().toISOString(),
  };
}

export const runRepo = {
  async record(run: {
    agent: AgentName;
    input: Record<string, unknown>;
    summary: string;
    resultPreview?: Record<string, unknown>;
  }): Promise<RunDoc> {
    if (dbStatus().mode === "mongo") {
      const doc = await DesignRunModel.create({
        agent: run.agent, input: run.input, summary: run.summary,
        resultPreview: run.resultPreview ?? {},
      });
      return toDoc(doc.toObject());
    }
    const doc: RunDoc = {
      id: randomUUID(), createdAt: new Date().toISOString(),
      agent: run.agent, input: run.input, summary: run.summary,
      resultPreview: run.resultPreview ?? {},
    };
    memory.set(doc.id, doc);
    return doc;
  },

  async list(limit = 20): Promise<RunDoc[]> {
    if (dbStatus().mode === "mongo") {
      const docs = await DesignRunModel.find().sort({ createdAt: -1 }).limit(limit).lean();
      return docs.map(toDoc);
    }
    return [...memory.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  },

  async stats() {
    const runs = await this.list(500);
    const byAgent: Record<string, number> = {};
    for (const r of runs) byAgent[r.agent] = (byAgent[r.agent] ?? 0) + 1;
    return {
      total: runs.length,
      byAgent,
      lastRunAt: runs[0]?.createdAt ?? null,
    };
  },
};
