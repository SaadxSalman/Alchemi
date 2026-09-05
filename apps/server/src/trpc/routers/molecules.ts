/** Molecules router — persistent molecular library (CRUD). */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { moleculeRepo } from "../../repositories/moleculeRepo";
import { pythonBridge } from "../../services/pythonBridge";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const smilesSchema = z
  .string()
  .min(1, "SMILES is required")
  .max(2000, "SMILES too long");

export const moleculesRouter = router({
  list: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).default(200) }).optional())
    .query(({ input }) => moleculeRepo.list(input?.limit ?? 200)),

  get: publicProcedure.input(z.object({ id: z.string().min(1) })).query(({ input }) =>
    moleculeRepo.get(input.id).then((m) => {
      if (!m) throw new TRPCError({ code: "NOT_FOUND", message: `Molecule ${input.id} not found` });
      return m;
    })
  ),

  save: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        smiles: smilesSchema,
        description: z.string().max(2000).optional(),
        source: z.enum(["manual", "designed", "example"]).default("manual"),
        tags: z.array(z.string().max(50)).max(20).default([]),
        properties: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Validate the structure against the AI engine (RDKit). If the engine
      // is down we still accept the molecule but flag validation as unknown.
      let validation: { valid: boolean; canonical_smiles: string; error: string } = {
        valid: false,
        canonical_smiles: input.smiles,
        error: "ai-engine-unavailable",
      };
      try {
        validation = await pythonBridge.validate(input.smiles);
      } catch {
        /* keep fallback flag */
      }
      if (validation.error !== "ai-engine-unavailable" && !validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid SMILES: ${validation.error}`,
        });
      }
      const doc = await moleculeRepo.save({
        ...input,
        smiles: validation.canonical_smiles || input.smiles,
        properties: {
          ...(input.properties ?? {}),
          validatedByAiEngine: validation.error !== "ai-engine-unavailable",
        },
      });
      return doc;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input }) =>
      moleculeRepo.delete(input.id).then((ok) => {
        if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: `Molecule ${input.id} not found` });
        return { deleted: true };
      })
    ),
});
