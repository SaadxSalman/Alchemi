# Alchemi web frontend (Next.js 15)
# NOTE: build context is the REPO ROOT (see docker-compose.yml) because the
# web app type-shares tRPC routes from apps/server/src via the @server/* alias.
FROM node:20-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── web dependencies ─────────────────────────────────────────────
FROM base AS web-deps
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm install --no-audit --no-fund

# ── server dependencies (so tsc/next can resolve @server/* transitives) ──
FROM base AS server-deps
COPY apps/server/package.json apps/server/package-lock.json* ./server/
RUN cd server && npm install --no-audit --no-fund

# ── build ────────────────────────────────────────────────────────
FROM base AS build
COPY --from=web-deps /app/node_modules ./node_modules
COPY apps/web/ .
COPY apps/server/package.json apps/server/package-lock.json* ./server/
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY apps/server/src ./server/src
RUN npm run build

# ── runtime ──────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next ./.next
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]