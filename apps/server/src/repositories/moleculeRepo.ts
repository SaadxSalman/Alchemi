/**
 * Molecule repository — MongoDB implementation with an in-memory fallback
 * (used when Mongo is unreachable) exposing the identical interface.
 */
import { randomUUID } from "crypto";
import { dbStatus } from "../db";
import { MoleculeModel } from "../models/Molecule";

export interface MoleculeDoc {
  id: string;
  name: string;
  smiles: string;
  description: string;
  source: "manual" | "designed" | "example";
  tags: string[];
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const SEED: Array<Pick<MoleculeDoc, "name" | "smiles" | "description">> = [
  { name: "Aspirin", smiles: "CC(=O)Oc1ccccc1C(=O)O", description: "Classic NSAID; COX inhibitor." },
  { name: "Caffeine", smiles: "Cn1cnc2c1c(=O)n(C)c(=O)n2C", description: "CNS stimulant, xanthine alkaloid." },
  { name: "Ibuprofen", smiles: "CC(C)Cc1ccc(C(C)C(=O)O)cc1", description: "Propionic-acid NSAID." },
  { name: "Paracetamol", smiles: "CC(=O)Nc1ccc(O)cc1", description: "Analgesic / antipyretic." },
  { name: "Sulfanilamide", smiles: "Nc1ccc(S(N)(=O)=O)cc1", description: "First-generation sulfonamide antibiotic." },
];

// ── in-memory store ─────────────────────────────────────────────────────────
const memory = new Map<string, MoleculeDoc>();

function seedMemoryStore() {
  if (memory.size > 0) return;
  const now = new Date().toISOString();
  for (const s of SEED) {
    const id = randomUUID();
    memory.set(id, {
      id, name: s.name, smiles: s.smiles, description: s.description,
      source: "example", tags: ["seed"], properties: {},
      createdAt: now, updatedAt: now,
    });
  }
}

function toDoc(x: any): MoleculeDoc {
  return {
    id: String(x.id ?? x._id),
    name: x.name, smiles: x.smiles, description: x.description ?? "",
    source: x.source ?? "manual", tags: x.tags ?? [],
    properties: x.properties ?? {},
    createdAt: x.createdAt ? new Date(x.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: x.updatedAt ? new Date(x.updatedAt).toISOString() : new Date().toISOString(),
  };
}

export const moleculeRepo = {
  mode(): "mongo" | "memory" {
    return dbStatus().mode;
  },

  async list(limit = 200): Promise<MoleculeDoc[]> {
    if (dbStatus().mode === "mongo") {
      const docs = await MoleculeModel.find().sort({ createdAt: -1 }).limit(limit).lean();
      return docs.map(toDoc);
    }
    seedMemoryStore();
    return [...memory.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  },

  async get(id: string): Promise<MoleculeDoc | null> {
    if (dbStatus().mode === "mongo") {
      const doc = await MoleculeModel.findById(id).lean();
      return doc ? toDoc(doc) : null;
    }
    return memory.get(id) ?? null;
  },

  async save(input: {
    name: string; smiles: string; description?: string;
    source?: MoleculeDoc["source"]; tags?: string[]; properties?: Record<string, unknown>;
  }): Promise<MoleculeDoc> {
    const payload = {
      name: input.name,
      smiles: input.smiles,
      description: input.description ?? "",
      source: input.source ?? "manual",
      tags: input.tags ?? [],
      properties: input.properties ?? {},
    };
    if (dbStatus().mode === "mongo") {
      const doc = await MoleculeModel.create(payload);
      return toDoc(doc.toObject());
    }
    const now = new Date().toISOString();
    const doc: MoleculeDoc = { id: randomUUID(), createdAt: now, updatedAt: now, ...payload };
    memory.set(doc.id, doc);
    return doc;
  },

  async delete(id: string): Promise<boolean> {
    if (dbStatus().mode === "mongo") {
      const res = await MoleculeModel.findByIdAndDelete(id);
      return Boolean(res);
    }
    return memory.delete(id);
  },

  async count(): Promise<number> {
    if (dbStatus().mode === "mongo") return MoleculeModel.countDocuments();
    seedMemoryStore();
    return memory.size;
  },
};
