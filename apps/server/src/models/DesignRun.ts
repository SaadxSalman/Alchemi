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

export const DesignRunModel =
  (mongoose.models.DesignRun as mongoose.Model<any>) ||
  mongoose.model<any>("DesignRun", DesignRunSchema);
