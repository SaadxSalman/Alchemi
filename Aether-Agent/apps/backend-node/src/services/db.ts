import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/aether-agent';

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    // Do not crash — app should still boot so REST/health endpoints work.
  }
}

export const db = mongoose.connection;

export { MONGODB_URI };