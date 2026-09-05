/**
 * MongoDB connection with graceful in-memory fallback:
 * if Mongo is unreachable (or MONGODB_URI is empty) the server degrades to
 * an ephemeral in-memory store so the whole stack stays operational.
 */
import mongoose from "mongoose";
import { env } from "./env";

export type DbMode = "mongo" | "memory";

let mode: DbMode = "memory";
let lastError = "";

export async function connectDatabase(): Promise<DbMode> {
  if (!env.mongodbUri) {
    mode = "memory";
    lastError = "MONGODB_URI not configured";
    return mode;
  }
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 2500 });
    mode = "mongo";
    console.log(`[db] MongoDB connected → ${env.mongodbUri.replace(/\/\/.*@/, "//<redacted>@")}`);
  } catch (err) {
    mode = "memory";
    lastError = err instanceof Error ? err.message : String(err);
    console.warn(`[db] MongoDB unavailable (${lastError}) — using in-memory store`);
  }
  return mode;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
}

export const dbStatus = () => ({ mode, lastError, connected: mongoose.connection.readyState === 1 });
