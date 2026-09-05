/**
 * pythonBridge — the AI Bridge layer. Axios client that talks to the
 * Python FastAPI engine (GATv2 + RDKit + LangChain agents).
 */
import axios, { AxiosError } from "axios";
import { env } from "../env";

const client = axios.create({
  baseURL: env.aiEngineUrl,
  timeout: env.aiEngineTimeoutMs,
  headers: { "Content-Type": "application/json" },
});

function describeError(err: unknown): string {
  if (err instanceof AxiosError) {
    const detail = (err.response?.data as any)?.detail;
    if (typeof detail === "string") return detail;
    if (detail) return JSON.stringify(detail);
    if (err.code === "ECONNABORTED") return "AI engine timed out";
    return `AI engine unreachable at ${env.aiEngineUrl} (${err.message})`;
  }
  return err instanceof Error ? err.message : String(err);
}

async function call<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    const res = await fn();
    return res.data;
  } catch (err) {
    throw new Error(describeError(err));
  }
}

export interface AiHealth {
  status: string;
  service: string;
  version: string;
  rdkit_available: boolean;
  torch_available: boolean;
  gatv2_loaded: boolean;
  llm: { provider: string; model: string };
  knowledge_graph: Record<string, unknown>;
}

export const pythonBridge = {
  async health(): Promise<AiHealth> {
    return call(() => client.get<AiHealth>("/health"));
  },
  async validate(smiles: string) {
    return call(() =>
      client.post<{ valid: boolean; canonical_smiles: string; error: string; molecular_weight: number }>(
        "/api/v1/validate", { smiles }
      )
    );
  },
  async render(smiles: string, width = 420, height = 320) {
    return call(() =>
      client.post<{ smiles: string; svg: string }>("/api/v1/render", { smiles, width, height })
    );
  },
  design(payload: unknown) {
    return call(() => client.post("/api/v1/agents/molecule-design", payload));
  },
  pathway(payload: unknown) {
    return call(() => client.post("/api/v1/agents/reaction-prediction", payload));
  },
  simulate(payload: unknown) {
    return call(() => client.post("/api/v1/agents/simulation", payload));
  },
};
