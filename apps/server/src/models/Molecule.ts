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
    },
    tags: { type: [String], default: [] },
    properties: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const MoleculeModel =
  (mongoose.models.Molecule as mongoose.Model<any>) ||
  mongoose.model<any>("Molecule", MoleculeSchema);
