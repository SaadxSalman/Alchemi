import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc/routers/_app';
import { createContext } from './trpc/context';
import { connectDB } from './services/db';
import { milvus } from './services/milvus';

// Load apps/backend-node/.env if present, then the monorepo-root .env
// (without overriding anything already set) so `npm run dev` just works.
dotenv.config();
dotenv.config({ path: resolve(__dirname, '../../../.env') });

const PORT = Number(process.env.PORT ?? 4000);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

async function main() {
  // Best-effort infra connections — the server still boots if they're down.
  await connectDB();
  await milvus.ensureCollection();

  const app = express();

  app.use(
    cors({
      origin: WEB_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'aether-backend', timestamp: new Date().toISOString() });
  });

  // tRPC API
  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  app.listen(PORT, () => {
    console.log(`🚀 Aether-Agent backend running on http://localhost:${PORT}`);
    console.log(`   tRPC endpoint: http://localhost:${PORT}/trpc`);
    console.log(`   Health check:  http://localhost:${PORT}/health`);
  });
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

main().catch((err) => {
  console.error('Fatal error starting backend:', err);
  process.exit(1);
});
