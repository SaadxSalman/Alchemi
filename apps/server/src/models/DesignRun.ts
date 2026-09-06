/** MongoDB schema for an agent run (design / pathway / simulation history). */
import mongoose, { Schema } from "mongoose";

const DesignRunSchema = new Schema(
  {
    agent: {
      type: String,
      enum: ["molecule-design", "reaction-prediction", "simulation"],
      required: true,
      index: true,
    },
    input: { type: Schema.Types.Mixed, required: true },
    summary: { type: String, default: "" },
    resultPreview: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Compound index for the stats query (agent breakdown over time).
DesignRunSchema.index({ agent: 1, createdAt: -1 });

export const DesignRunModel =
  (mongoose.models.DesignRun as mongoose.Model<any>) ||
  mongoose.model<any>("DesignRun", DesignRunSchema);
