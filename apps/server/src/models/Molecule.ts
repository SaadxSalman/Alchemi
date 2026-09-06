/** MongoDB schema for a saved molecule (flexible document store). */
import mongoose, { Schema } from "mongoose";

const MoleculeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    smiles: { type: String, required: true, index: true },
    description: { type: String, default: "" },
    source: {
      type: String,
      enum: ["manual", "designed", "example"],
      default: "manual",
      index: true,
    },
    tags: { type: [String], default: [], index: true },
    properties: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Compound index for common query patterns.
MoleculeSchema.index({ source: 1, createdAt: -1 });
MoleculeSchema.index({ name: "text", description: "text" });

export const MoleculeModel =
  (mongoose.models.Molecule as mongoose.Model<any>) ||
  mongoose.model<any>("Molecule", MoleculeSchema);
