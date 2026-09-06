/** Agents router — the three autonomous agents, bridged to the AI engine.
 *  Long-running jobs are enqueued via BullMQ; the client polls for results. */
import { z } from "zod";
import { runRepo } from "../../repositories/runRepo";
import { pythonBridge } from "../../services/pythonBridge";
import { enqueueAgentJob } from "../../queue";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { logger } from "../../logger";

const propertyTargetsSchema = z.object({
  mw_min: z.number().min(10).max(2000).default(150),
  mw_max: z.number().min(50).max(2000).default(500),
  logp_min: z.number().min(-10).max(10).default(-0.5),
  logp_max: z.number().min(-10).max(10).default(5),
  tpsa_min: z.number().min(0).max(500).default(20),
  tpsa_max: z.number().min(0).max(500).default(140),
  hbd_max: z.number().int().min(0).max(20).default(5),
  hba_max: z.number().int().min(0).max(40).default(10),
});

/* ── AI-engine response shapes (mirrors services/ai-engine/schemas.py) ── */
export interface AgentStepDto {
  step: number;
  level: "thought" | "tool" | "observation" | "answer";
  message: string;
  detail?: string;
  duration_ms?: number;
}

export interface DescriptorsDto {
  smiles: string;
  molecular_weight: number;
  logp: number;
  tpsa: number;
  hbd: number;
  hba: number;
  rotatable_bonds: number;
  heavy_atoms: number;
  ring_count: number;
  aromatic_rings: number;
  fraction_csp3: number;
  formal_charge: number;
  qed: number;
  aromatic_proportion: number;
}

export interface CandidateDto {
  smiles: string;
  valid: boolean;
  score: number;
  rank: number;
  origin: string;
  rationale: string;
  descriptors: DescriptorsDto;
  predicted: { logp: number; tpsa: number; log_solubility: number; model: string };
  alerts: Array<{ source: string; description: string }>;
  passes_lipinski: boolean;
}

export interface DesignResultDto {
  objective: string;
  candidates: CandidateDto[];
  agent_steps: AgentStepDto[];
  summary: string;
  llm_provider: string;
  generator_stats: Record<string, number>;
}

export interface PathwayResultDto {
  target_smiles: string;
  valid: boolean;
  error: string;
  steps: Array<{
    step: number;
    reaction_name: string;
    reactants: string[];
    product: string;
    reagents: string[];
    conditions: string;
    confidence: number;
    typical_yield: string;
  }>;
  starting_materials: string[];
  overall_confidence: number;
  estimated_overall_yield: number;
  is_complete: boolean;
  agent_steps: AgentStepDto[];
  narrative: string;
}

export interface SimulationResultDto {
  smiles: string;
  canonical_smiles: string;
  valid: boolean;
  error: string;
  descriptors?: DescriptorsDto | null;
  predicted?: { logp: number; tpsa: number; log_solubility: number; model: string } | null;
  rule_checks: Array<{ name: string; passed: boolean; detail: string }>;
  alerts: Array<{ source: string; description: string }>;
  conformer: { generated: boolean; energy_kcal_mol?: number | null; method: string };
  drug_likeness_score: number;
  agent_steps: AgentStepDto[];
  narrative: string;
}

export const agentsRouter = router({
  /** Molecule Design Agent — enqueues a background job, returns jobId. */
  design: protectedProcedure
    .input(
      z.object({
        objective: z.string().min(3).max(2000),
        numCandidates: z.number().int().min(1).max(12).default(5),
        targets: propertyTargetsSchema.optional(),
        drugLike: z.boolean().default(true),
        avoidPains: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const payload = {
        objective: input.objective,
        num_candidates: input.numCandidates,
        drug_like: input.drugLike,
        avoid_pains: input.avoidPains,
        ...(input.targets ? { targets: input.targets } : {}),
      };
      const result = await enqueueAgentJob("molecule-design", payload);
      logger.info({ jobId: result.jobId, queued: result.queued }, "design job enqueued");
      return result;
    }),

  /** Reaction Prediction Agent — enqueues a background job, returns jobId. */
  predictPathway: protectedProcedure
    .input(
      z.object({
        targetSmiles: z.string().min(1).max(2000),
        maxSteps: z.number().int().min(1).max(8).default(4),
      })
    )
    .mutation(async ({ input }) => {
      const result = await enqueueAgentJob("reaction-prediction", {
        target_smiles: input.targetSmiles,
        max_steps: input.maxSteps,
      });
      logger.info({ jobId: result.jobId, queued: result.queued }, "pathway job enqueued");
      return result;
    }),

  /** Simulation Agent — enqueues a background job, returns jobId. */
  simulate: protectedProcedure
    .input(z.object({ smiles: z.string().min(1).max(2000) }))
    .mutation(async ({ input }) => {
      const result = await enqueueAgentJob("simulation", input);
      logger.info({ jobId: result.jobId, queued: result.queued }, "simulation job enqueued");
      return result;
    }),
});
