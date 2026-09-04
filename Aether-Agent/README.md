# Aether-Agent 🌍🤝

**An AI agent platform for humanitarian crisis response** — it watches satellite imagery, classifies disasters, predicts what affected communities need, and coordinates aid transparently on Solana.

> **This README is self-contained.** Everything a developer — human or AI agent — needs to understand, run, extend, and deploy this project is documented here. No tribal knowledge required.

| | |
| --- | --- |
| **Repo type** | npm-workspaces monorepo (TypeScript + Rust) |
| **Stack** | Next.js 16 · tRPC 11 · Express 5 · MongoDB · Milvus 2.4 · Rust/Axum · Solana/Anchor |
| **Minimum to run** | Node.js ≥ 20 — every other service is optional (graceful degradation) |
| **Status** | ✅ Functional end-to-end locally · deployment guide included |

---

## 📑 Table of Contents

1. [What is Aether-Agent](#1-what-is-aether-agent)
2. [Features](#2-features)
3. [Architecture](#3-architecture)
4. [Tech Stack](#4-tech-stack)
5. [Repository Layout](#5-repository-layout)
6. [Getting Started](#6-getting-started)
7. [Configuration](#7-configuration)
8. [API Reference](#8-api-reference)
9. [The Agents in Detail](#9-the-agents-in-detail)
10. [Frontend Guide](#10-frontend-guide)
11. [Solana Program Guide](#11-solana-program-guide)
12. [Development Guide for Humans and Agents](#12-development-guide-for-humans-and-agents)
13. [Deployment Guide](#13-deployment-guide)
14. [Operational Degradation](#14-operational-degradation)
15. [Troubleshooting](#15-troubleshooting)
16. [Roadmap](#16-roadmap)
17. [License](#17-license)

---

## 1. What is Aether-Agent

Aether-Agent is organised around **three cooperating agents** plus a shared vector memory:

| Agent | Job | Where it lives |
| --- | --- | --- |
| 🛰️ **Monitoring Agent** | Ingests satellite image URLs → classifies crisis type, severity and confidence → stores incidents | `apps/backend-node` → `packages/rust-core` |
| 📦 **Resource Allocation Agent** | Turns a crisis into a concrete, auditable aid package (water, meals, kits) with a priority level | `apps/backend-node/src/services/allocation.ts` |
| 📡 **Communication Agent** | Coordinates on-chain: records crisis reports on Solana so aid flows stay auditable | `apps/backend-node` + Anchor program |
| 🧠 **Multi-Modal Memory** | Embeds every analysis (image + text) into Milvus so past crises can be recalled by similarity | `services/embeddings.ts` + `services/milvus.ts` |

**The core loop:**

```text
 satellite image ──▶ classify (Rust vision core) ──▶ store (MongoDB)
                           │
                           └─▶ embed (768-dim) ──▶ remember (Milvus) ──▶ recall similar crises
                                        │
 crisis record ──▶ predict needs (allocation) ──▶ log on-chain (Solana) ──▶ dashboard
```

The dashboard (Next.js) is the window into this loop: live incidents, stats, an analysis
form, predicted aid packages, wallet-connected on-chain logging, and similarity search.

---

## 2. Features

  * **Autonomous crisis detection** — satellite images are classified into Flood, Wildfire, Earthquake, Drought, Landslide and more, each with severity (0–1) and confidence.
  * **Intelligent resource allocation** — transparent, formula-driven aid estimates a field coordinator can audit before dispatching goods.
  * **On-chain coordination** — the `aether-contracts` Anchor program stores authority, crisis type, severity and timestamp in a PDA account; works against localnet/devnet or returns simulated receipts offline.
  * **Satellite vision pipeline** — a pure-Rust feature extractor (luminance, colour dominance, texture variance) standing in for a Vision Transformer, with a drop-in API for real weights.
  * **Multi-modal memory** — every analysis lands in a 768-dim Milvus collection with both image and text vectors; similarity search degrades to MongoDB text search when Milvus is offline.
  * **End-to-end type safety** — the dashboard calls tRPC procedures typed by the backend's own `AppRouter`; a backend change breaks the web build, never production.
  * **Zero-config resilience** — MongoDB, Milvus, rust-core and Solana are all optional at runtime; the stack keeps serving (see §14).

## 3. Architecture

### 3.1 System diagram

```text
┌────────────────────────── Your browser ──────────────────────────┐
│  Next.js 16 dashboard (apps/web, port 3000)                      │
│  app/page.tsx · components/{WalletButton, AidDashboard,          │
│  MemorySearch} · hooks/{useTRPC, useSolana}                      │
└──────────────┬───────────────────────────────────────┬───────────┘
               │ tRPC httpBatchLink (typed)            │ REST /health
               ▼                                       │
┌──────────── Node orchestrator (apps/backend-node, :4000) ────────┐
│  tRPC routers:  monitor · solana · allocation                    │
│  services:      rustCore · milvus (REST v2) · solana (JSON-RPC)  │
│                 embeddings · allocation · db (Mongoose)          │
└────┬──────────────────┬──────────────────┬──────────────┬────────┘
     │ HTTP /analyze    │ REST v2 :9091    │ JSON-RPC     │ Mongoose
     ▼                  ▼                  ▼              ▼
┌───────────┐    ┌────────────┐    ┌────────────┐  ┌──────────┐
│ rust-core │    │   Milvus   │    │  Solana    │  │ MongoDB  │
│ Axum :50051│   │ vector DB  │    │ validator  │  │  :27017  │
└───────────┘    └────────────┘    └────────────┘  └──────────┘
        every one of these four services is OPTIONAL (see §14)
```

### 3.2 Request lifecycle — "Run crisis analysis" click

1. `page.tsx` calls `analyze.mutate({ imageUrl })` → tRPC POST to `/trpc/monitor.analyzeSatellite`.
2. Backend calls **rust-core** `POST /analyze` (8 s timeout). If Rust is down, a deterministic Node-side mock with the identical response shape is used instead.
3. Backend embeds the result with `embedText()` + `embedImage()` → two 768-dim vectors.
4. Backend inserts the vectors into Milvus and searches for similar past crises (best-effort, silently skipped when Milvus is offline).
5. Backend creates a MongoDB `Crisis` document (best-effort; a `mock-…` id is returned when Mongo is offline).
6. Response: `{ id, type, severity, confidence, status, location, message, similar[], vectorMemory }`.
7. React Query invalidates `getActiveCrises` + `getStats` → the dashboard refetches.
8. The **Resource Allocation** panel recomputes the aid package for the most severe crisis; with a connected wallet, **Log Crisis On-Chain** calls `solana.reportCrisis` and the signature is stored on the crisis record (`solanaTx`).

### 3.3 Design decisions — read before changing anything

| Decision | Why |
| --- | --- |
| tRPC with `AppRouter` imported **directly from backend source** (`apps/web/src/utils/trpc.ts`) | Zero API drift: change a procedure in the backend and the web type-check fails loudly at build time, not in production |
| Every optional integration wrapped in try/catch with a documented fallback | The demo must never die because Mongo/Milvus/Rust/Solana is offline |
| Deterministic "AI" (FNV-1a hash mocks + seeded embeddings) | Same input → same output: stable UX, testable, zero API keys |
| Milvus via RESTful v2 on port **9091**, no SDK | No native/gRPC dependency; the HTTP API is stable and already exposed by docker-compose |
| Simulated Solana receipts (prefix `sim_`) without a validator | The on-chain flow is demonstrable offline; going live is a one-function change (§12.4) |
| Polling (React Query, 15 s) instead of WebSockets | Free hosting-friendly; WebSockets are on the roadmap |

## 4. Tech Stack

A "Safety-First, Performance-Driven" stack: Rust's computational efficiency, Node's developer velocity, Solana's transparency.

| Layer | Technology | Why |
| --- | --- | --- |
| **Frontend** | Next.js 16 (App Router, Turbopack) | SSR/SEO for public crisis reports, fast data-heavy dashboards |
| | Tailwind CSS 4 | Rapid responsive UI for field workers on mobile |
| | TypeScript + tRPC 11 + React Query 5 | End-to-end typed RPC + caching/polling without a socket server |
| | React Compiler | Automatic memoization (`babel-plugin-react-compiler`) |
| **Backend** | Node.js + Express 5 | The orchestrator: sessions, routing between AI, DBs and blockchain |
| | tRPC 11 (`@trpc/server` express adapter) | "Zero-API" typed procedures shared with the frontend |
| | Rust (Axum 0.7, Tokio) | High-performance vision feature extraction + classification |
| **Databases** | Milvus 2.4 (vector DB) | Multi-modal embeddings for similarity search (REST v2 API on :9091) |
| | MongoDB 7 + Mongoose 9 | Crisis history, logistics metadata, user profiles |
| **Intelligence** | Pure-Rust vision features (ViT-ready) | Luminance / colour dominance / texture variance from satellite patches |
| | Deterministic embeddings (768-dim) | Multi-modal space so "flood photos" and "flood reports" are comparable |
| **Blockchain** | Solana + Anchor 0.32.1 | High throughput, low fees for micro-aid transactions; gold-standard program security |
| **DevOps** | Docker Compose | Identical Milvus/etcd/MinIO/Mongo stack locally and in production |

**Why this works:** (1) the *Rust bridge* gives memory-efficient AI compute behind a friendly Node API; (2) *Solana's speed* records crisis data on-chain in sub-second time when minutes matter; (3) *Milvus gives the agent a visual memory* — traditional DBs can't "search" an image.

---

## 5. Repository Layout

Every file, one line each — this map + §12 is all an agent needs to navigate.

```text
Aether-Agent/
├── package.json                  # npm workspaces root: apps/* + packages/*, dev/build scripts
├── docker-compose.yml            # mongo:7, etcd, minio, milvus v2.4.1 standalone
├── .env / .env.example           # environment template (backend reads it via dotenv)
├── apps/
│   ├── backend-node/             # Express + tRPC orchestrator (port 4000)
│   │   ├── src/index.ts          # entry: dotenv, CORS, /health, tRPC middleware, shutdown hooks
│   │   ├── src/trpc/trpc.ts      # tRPC init (router, publicProcedure)
│   │   ├── src/trpc/context.ts   # per-request context (req, res, db)
│   │   ├── src/trpc/routers/_app.ts     # root router — AppRouter type = the API contract
│   │   ├── src/trpc/routers/monitor.ts  # getActiveCrises, getStats, analyzeSatellite, searchSimilar
│   │   ├── src/trpc/routers/solana.ts   # health, reportCrisis
│   │   ├── src/trpc/routers/allocation.ts # estimateNeeds
│   │   ├── src/services/rustCore.ts     # HTTP client to rust-core + deterministic mock fallback
│   │   ├── src/services/milvus.ts       # Milvus RESTful v2 client (schema, insert, search, healthz)
│   │   ├── src/services/solana.ts       # Solana JSON-RPC client + simulated receipts
│   │   ├── src/services/embeddings.ts   # FNV-1a seeded 768-dim text/image embedders
│   │   ├── src/services/allocation.ts   # Resource Allocation Agent formulas
│   │   ├── src/services/db.ts           # Mongoose connection (3s server-selection timeout)
│   │   └── src/models/crisis.ts         # Crisis schema (type, severity, location, status, solanaTx…)
│   └── web/                      # Next.js 16 dashboard (port 3000)
│       ├── src/app/page.tsx      # the whole dashboard (client component)
│       ├── src/app/layout.tsx    # fonts + <Providers>
│       ├── src/app/providers.tsx # tRPC client (httpBatchLink) + React Query
│       ├── src/hooks/useTRPC.ts  # re-exports typed trpc + useBackendHealth()
│       ├── src/hooks/useSolana.ts# Phantom connect/disconnect + SOL balance
│       ├── src/components/WalletButton.tsx  # connect / address + balance pill
│       ├── src/components/AidDashboard.tsx  # allocation grid + "Log Crisis On-Chain"
│       ├── src/components/MemorySearch.tsx  # free-text similarity search panel
│       └── src/utils/trpc.ts     # createTRPCReact<AppRouter> + API_BASE
├── packages/
│   ├── rust-core/                # AI & vision service (Axum, port 50051)
│   │   ├── src/main.rs           # POST /analyze, GET /health, reqwest fetch + fallback
│   │   ├── src/lib.rs            # library root (pub mod processor, vision)
│   │   ├── src/processor.rs      # classify() heuristics + CrisisVerdict::fallback_for + tests
│   │   └── src/vision/model.rs   # SatelliteAnalyzer::extract_features (image → ImageFeatures)
│   └── solana-program/aether-contracts/
│       ├── Anchor.toml           # localnet, program id, npm scripts
│       ├── programs/aether-agent/src/lib.rs  # report_crisis instruction + CrisisAccount PDA
│       └── tests/aether-agent.ts # ts-mocha integration tests (record/update/reject)
```

## 6. Getting Started

### 6.1 Prerequisites

| Tool | Required? | Used for |
| --- | --- | --- |
| **Node.js ≥ 20** + npm | ✅ required | Backend orchestrator + Next.js dashboard |
| Docker | optional | MongoDB, Milvus, etcd, MinIO containers |
| Rust ≥ 1.75 (cargo) | optional | The rust-core vision service |
| Solana CLI + Anchor ≥ 0.32 | optional | Building/deploying the on-chain program |

> Every optional service degrades gracefully — the full stack runs with **only Node.js installed**.

### 6.2 Quickstart (3 commands)

```bash
npm install          # installs all workspaces (hoisted to repo root)
npm run docker:up    # OPTIONAL: MongoDB + Milvus + etcd + MinIO
npm run dev          # backend (:4000) + web (:3000), colour-coded logs
```

Open **http://localhost:3000** 🎉 — the dashboard works immediately with seeded data.
`Ctrl+C` stops `npm run dev`. To run the services separately: `npm run dev:backend` / `npm run dev:web`.

### 6.3 Optional: the Rust AI core (real image analysis)

```bash
npm run build:rust   # cargo build --release
npm run run:rust     # serves http://localhost:50051 (POST /analyze, GET /health)
```

Without it, `analyzeSatellite` uses a deterministic Node-side mock — same response shape, so the UI is unaffected. The Rust service loads **no model weights**: it downloads the image, computes pixel statistics and classifies (§9.1). Swapping in a real ViT later touches only `packages/rust-core/src/vision/model.rs`.

### 6.4 Optional: Solana program

```bash
cd packages/solana-program/aether-contracts
anchor build         # compiles the Anchor program
anchor test          # builds, starts a local validator, runs the ts-mocha suite
anchor deploy        # deploys to the configured cluster (localnet by default)
```

Without a validator, on-chain logging returns simulated signatures (§9.4) — the whole UI flow still works.

### 6.5 Verify your install

```bash
curl http://localhost:4000/health
# → {"status":"ok","service":"aether-backend","timestamp":"…"}

curl http://localhost:4000/trpc/monitor.getActiveCrises
# → {"result":{"data":[ … seeded crises … ]}}
```

Then in the browser: check the badge says **Real-time monitoring**, submit the analysis form, connect a wallet, press **Log Crisis On-Chain**.

### 6.6 Dev/test commands

| Command | Action |
| --- | --- |
| `npm run dev` | Backend + web concurrently (colour-coded logs) |
| `npm run build` | Build backend (`tsc`) then web (`next build`) |
| `npm run typecheck` | Strict TS check of the backend |
| `npm run build:rust` / `npm run run:rust` | Build / run the Rust core |
| `cargo test --manifest-path packages/rust-core/Cargo.toml` | Rust unit tests (classifier, features, fallback) |
| `npm run docker:up` / `npm run docker:down` | Start / stop the infra containers |

---

## 7. Configuration

The backend loads `apps/backend-node/.env` first, then the **repo-root `.env`** (no overrides). Copy `.env.example` → `.env` and adjust:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Backend port (Render/PaaS inject this automatically) |
| `WEB_ORIGIN` | `http://localhost:3000` | CORS origin for the dashboard (must match exactly; credentials are enabled) |
| `MONGODB_URI` | `mongodb://localhost:27017/aether-agent` | Crisis history store |
| `RUST_CORE_URL` | `http://localhost:50051` | Rust AI core endpoint |
| `MILVUS_URL` | `http://localhost:9091` | Milvus **RESTful v2** HTTP port — *not* the gRPC port 19530 |
| `SOLANA_RPC_URL` | `http://127.0.0.1:8899` | Solana RPC endpoint |
| `SOLANA_PROGRAM_ID` | `G4ssk…3Pnd` | aether-contracts program address |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Backend URL baked into the web bundle at **build time** |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Wallet balance lookups in the browser |
| `RUST_CORE_PORT` | `50051` | Port the Rust service binds (read by rust-core itself) |
| `SENTINEL_HUB_API_KEY` etc. | unset | Reserved for real satellite/news ingestion (roadmap) |

> `NEXT_PUBLIC_*` variables are inlined by Next.js **at build time** — changing them requires a rebuild/redeploy.

## 8. API Reference

Base URL: `http://localhost:4000`. tRPC is mounted at `/trpc`, REST health at `/health`.
Procedures are also visible in typed form via `AppRouter` (exported from `apps/backend-node/src/trpc/routers/_app.ts`).

**Call formats** (tRPC v11, no data transformer):
- Queries (GET): `/trpc/<router>.<procedure>` — with input, append `?input=<URL-encoded JSON>`
- Mutations (POST): `/trpc/<router>.<procedure>` with the raw input JSON as the body
- The web client uses batched POSTs (`/trpc?batch=1`) — same procedures

### 8.1 REST

| Endpoint | Response |
| --- | --- |
| `GET /health` | `{"status":"ok","service":"aether-backend","timestamp":"2026-09-04T01:34:50.438Z"}` |

### 8.2 monitor router

**`monitor.getActiveCrises`** (query, no input) → array. Active crises from MongoDB; if Mongo is empty/offline, the seeded sample (`fallbackCrises` in `monitor.ts`) is returned.

```bash
curl http://localhost:4000/trpc/monitor.getActiveCrises
```
```json
[{"id":"seed-1","type":"Flood","severity":0.91,"location":"Lahore, Pakistan",
  "status":"response-active","confidence":0.94}]
```

**`monitor.getStats`** (query, no input) → `{ active, critical, mostCommonType, source }` where `source` is `mongodb` or `fallback`.

**`monitor.analyzeSatellite`** (mutation) — the full Vision pipeline. Input: `{ imageUrl: string (must be a valid URL) }`.

```bash
curl -X POST http://localhost:4000/trpc/monitor.analyzeSatellite \
  -H "Content-Type: application/json" \
  -d "{\"imageUrl\":\"https://images.unsplash.com/photo-1500375592092-40eb2168fd21\"}"
```
```json
{"result":{"data":{"id":"66f…","type":"Wildfire","severity":0.61,"confidence":0.76,
 "status":"monitoring","location":"Auto-detected",
 "message":"Crisis Wildfire flagged successfully.",
 "similar":[{"id":"3","distance":0.42,"crisisType":"Wildfire","source":"satellite"}],
 "vectorMemory":true}}}
```
`similar` is empty and `vectorMemory` false when Milvus is offline. Without Mongo the `id` looks like `mock-1788485720899`.

**`monitor.searchSimilar`** (query) — multi-modal memory search. Input: `{ query: string (≥2 chars), limit?: 1–20 (default 5) }`.

```bash
curl "http://localhost:4000/trpc/monitor.searchSimilar?input=%7B%22query%22%3A%22flood%20damage%22%2C%22limit%22%3A3%7D"
```
```json
{"result":{"data":{"source":"milvus","results":[
  {"id":"5","distance":0.31,"crisisType":"Flood","source":"satellite"}]}}}
```
`source` is `milvus` (vector search) → falls back to `mongodb` (regex text search) → `none`.

### 8.3 allocation router

**`allocation.estimateNeeds`** (query) — Resource Allocation Agent. Input: `{ crisisType: string, severity: 0–1, affectedPopulation?: int }`.

```bash
curl "http://localhost:4000/trpc/allocation.estimateNeeds?input=%7B%22crisisType%22%3A%22Flood%22%2C%22severity%22%3A0.9%7D"
```
```json
{"result":{"data":{"crisisType":"Flood","severity":0.9,
 "estimatedPeopleAffected":40500,"waterLiters":473850,"meals":364500,
 "medicalKits":2025,"shelterKits":8100,"hygieneKits":20250,
 "priority":"critical"}}}
```

### 8.4 solana router

**`solana.health`** (query) → `{ online, cluster, programId }`. `online:false` + `cluster:"unreachable"` when no validator/RPC is reachable (normal offline).

**`solana.reportCrisis`** (mutation) — Communication Agent. Input: `{ crisisId?: string, authority: string (32–64 chars), crisisType: string, severity: 0–1 }`.

```bash
curl -X POST http://localhost:4000/trpc/solana.reportCrisis \
  -H "Content-Type: application/json" \
  -d "{\"authority\":\"9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM\",\"crisisType\":\"Flood\",\"severity\":0.9}"
```
```json
{"result":{"data":{"authority":"9WzD…AWWM","crisisType":"Flood","severity":0.9,
 "timestamp":1788485720,"signature":"sim_1788485720abc","persisted":false}}}
```
With a live validator the signature is a real transaction signature; otherwise it is simulated (prefix `sim_`). `persisted:true` means `crisisId` was given and the signature was written to the Mongo record's `solanaTx` field.

## 9. The Agents in Detail

### 9.1 Monitoring Agent — vision pipeline

**Path:** `apps/web` → `monitor.analyzeSatellite` → `services/rustCore.ts` → **rust-core** (`POST /analyze`) → classification → persistence + memory.

**rust-core internals** (`packages/rust-core`):

1. `main.rs` receives `{ image_url }`, downloads the bytes with `reqwest` (rustls), decodes with the `image` crate.
2. `vision/model.rs` — `SatelliteAnalyzer::extract_features` downsizes the image to 64×64 and computes `ImageFeatures`:
   - `brightness` — mean Rec.709 luminance (0–1)
   - `blue_ratio` — fraction of water-like pixels (blue dominates by >15%)
   - `green_ratio` — vegetation-like pixels
   - `red_ratio` — burnt/earth-like pixels
   - `variance` — luminance variance ×4, clamped to 0–1 (texture chaos → rubble/debris)
3. `processor.rs` — `classify()` scores five hypotheses and picks the winner:

| Crisis | Score formula |
| --- | --- |
| Flood | `blue_ratio × 1.5 + (1 − brightness) × 0.5` |
| Wildfire | `red_ratio × 1.4 + (1 − green_ratio) × 0.6` |
| Drought | `brightness × 0.8 + (1 − green_ratio) × 0.8 − blue_ratio` |
| Landslide | `red_ratio × 0.7 + variance × 1.2` |
| Earthquake | `variance × 1.5 + (1 − blue_ratio) × 0.3` |

   - `severity = clamp(0.35 + best_score × 0.45, 0.1, 0.99)`
   - `confidence = 0.6 + 0.35 × margin` where `margin = (best − runner_up) / |best|`
4. **Fallback:** if download/decode fails, `CrisisVerdict::fallback_for(url)` derives a verdict from the FNV-1a hash of the URL — deterministic, offline-friendly.

**Node-side twin:** when rust-core is unreachable, `services/rustCore.ts` produces a hash-based result with the same JSON shape (`severity`, `crisis_type`, `confidence`) — values differ slightly from Rust's (4 crisis types, different ranges) but the contract is identical, so the UI never notices.

> 🔁 **Upgrading to a real ViT:** keep the endpoint contract `{image_url} → {severity, crisis_type, confidence}` and replace `extract_features` with tensor inference (e.g. `tch` + LibTorch or `ort` + ONNX). Nothing else in the stack changes.

### 9.2 Resource Allocation Agent

**Path:** `services/allocation.ts` — a pure function: `(crisisType, severity, affectedPopulation?) → AidPackage`. No I/O, fully auditable:

| Output | Formula |
| --- | --- |
| `estimatedPeopleAffected` | provided, else `50 000 × severity²` |
| `waterLiters` | `people × 9 L × 1.3` if Flood/Tsunami (contaminated sources), else `× 9 L` (3 L/day × 3 days) |
| `meals` | `people × 9 × 1.5` if Drought (longer duration), else `× 9` (3 meals × 3 days) |
| `medicalKits` | `people × 0.05 × 1.6` if trauma-heavy (Earthquake, Hurricane, Tornado, Volcanic Eruption), else `× 0.05` |
| `shelterKits` | `people × 0.2` if displacement-heavy (Earthquake, Wildfire, Flood, Volcanic Eruption), else `× 0.1` |
| `hygieneKits` | `people × 0.5` |
| `priority` | `critical ≥ 0.85 > high ≥ 0.65 > medium ≥ 0.4 > low` (on severity) |

The dashboard shows this package for the most severe active crisis (or the latest analysis).

### 9.3 Multi-Modal Memory (embeddings + Milvus)

**Path:** `services/embeddings.ts` + `services/milvus.ts`.

**Embedding algorithm** (deterministic, 768-dim, no model weights):
1. Tokenise the text (lowercase, strip punctuation).
2. For each token: FNV-1a hash → seed a Mulberry32 PRNG → add a fixed random projection (`rand() − 0.5`) to all 768 dimensions.
3. L2-normalise.

Shared tokens ⇒ correlated vectors, so `"flood damage"` lands near stored flood analyses. `embedImage(url, type)` embeds `"satellite image <url> <type>"` — stable for identical inputs.

**Milvus collection `crisis_embeddings`** (created idempotently on boot, RESTful v2 on `MILVUS_URL`):

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int64 | primary key, autoId |
| `image_vector` | FloatVector | dim 768, L2 index `image_vec_idx` |
| `text_vector` | FloatVector | dim 768, L2 index `text_vec_idx` |
| `crisis_type` | VarChar(64) | scalar metadata |
| `source` | VarChar(64) | e.g. `satellite` |

**Fallback chain** for `searchSimilar`: Milvus `text_vector` search → MongoDB `$or` regex on `description/type/crisisLabel` → empty result. Never throws.

### 9.4 Communication Agent (Solana)

**Path:** `services/solana.ts` → Solana JSON-RPC (`getHealth`) + the `aether-contracts` Anchor program.

- **With a validator:** `reportCrisis` first probes `getHealth`; a real implementation then submits the Anchor instruction (§11) and returns the transaction signature.
- **Without a validator:** returns a simulated receipt — `signature: sim_<base36 timestamp>` (or a hash-derived `sim_…` string when the RPC answers but the tx path is not yet wired). The flow, types and UI are identical either way.
- The receipt (`timestamp` unix-seconds, `signature`) is returned to the caller and, when `crisisId` was supplied and Mongo is up, written to the crisis document's `solanaTx` field.

---

## 10. Frontend Guide

### 10.1 Provider tree & data flow

```text
layout.tsx → <Providers>            (app/providers.tsx, 'use client')
  ├─ trpc.Provider  → httpBatchLink(`${API_BASE}/trpc`, credentials:'include')
  └─ QueryClientProvider
        └─ page.tsx (the dashboard)
```

`API_BASE` = `process.env.NEXT_PUBLIC_API_URL ?? http://localhost:4000` (`utils/trpc.ts`), baked in at build time.

### 10.2 Hooks reference

| Hook | File | Purpose |
| --- | --- | --- |
| `trpc` | `hooks/useTRPC.ts` | Typed tRPC proxy — `trpc.monitor.getActiveCrises.useQuery(…)` etc. |
| `useBackendHealth(pollMs=30000)` | `hooks/useTRPC.ts` | Polls REST `/health`; returns `null` (unknown) / `true` / `false` → status badge |
| `useSolana()` | `hooks/useSolana.ts` | `{ publicKey, balance, connecting, error, walletAvailable, connect, disconnect }` — works with any injected wallet (Phantom), balance via `@solana/web3.js` |

### 10.3 Page behaviour (app/page.tsx)

- `getActiveCrises` + `getStats` polled every **15 s**; mutations invalidate them.
- `target` = latest analysis result, else the most severe active crisis — drives the allocation panel and on-chain logging.
- IDs prefixed `seed-` / `mock-` are never sent as `crisisId` (they don't exist in Mongo).
- All mutations surface errors inline; every section has an empty/loading state.

### 10.4 Components

| Component | Props | Role |
| --- | --- | --- |
| `WalletButton` | wallet state + `onConnect/onDisconnect` (state is owned by the page via `useSolana`) | Connect pill / address + SOL balance |
| `AidDashboard` | `allocation?, isLoading, logging, disabled, onLogOnChain, txSignature?` | Aid-package grid + on-chain logging button + receipt |
| `MemorySearch` | none (self-contained) | Free-text similarity search over the crisis embedding space |

**Add a panel:** create `components/MyPanel.tsx` (client component, take data via props) → compose it in `page.tsx`. Add data with a tRPC procedure (§12.2) and read it in the page — the types flow automatically.

## 11. Solana Program Guide

**Location:** `packages/solana-program/aether-contracts` (Anchor 0.32.1, program name `aether_contracts`).

**Program ID consistency rule:** `declare_id!` in `programs/aether-agent/src/lib.rs` = `[programs.localnet]` id in `Anchor.toml` = `SOLANA_PROGRAM_ID` in `.env`. Changing one means changing all three and redeploying.

**Instruction — `report_crisis(crisis_type: String, severity: u8)`:**

| Validation | Error |
| --- | --- |
| `severity ≤ 100` | `AetherError::SeverityOutOfRange` |
| `crisis_type.len() ≤ 64` | `AetherError::CrisisTypeTooLong` |

**Account — `CrisisAccount`** (PDA seeds `[b"crisis", authority]`, `init_if_needed`, payer = authority):

| Field | Type | Bytes |
| --- | --- | --- |
| discriminator | Anchor | 8 |
| `authority` | Pubkey | 32 |
| `crisis_type` | String (≤64) | 4 + 64 |
| `severity` | u8 | 1 |
| `timestamp` | i64 (unix, set from `Clock`) | 8 |

Total space `8 + 32 + 4 + 64 + 1 + 8 = 117` bytes. One authority owns exactly one updatable crisis record (hence `init_if_needed` — the `anchor-lang` `init-if-needed` feature is enabled in `programs/aether-agent/Cargo.toml`).

**Tests** (`tests/aether-agent.ts`): records a report, updates the same PDA, and asserts `severity = 200` is rejected with `SeverityOutOfRange`.

**Commands:** `anchor build` → `anchor test` (builds + boots localnet + runs ts-mocha) → `anchor deploy`. Toolchain is pinned by `rust-toolchain.toml` (1.89.0). Requires the Solana CLI and a wallet at `~/.config/solana/id.json` (see `[provider]` in Anchor.toml).

---

## 12. Development Guide for Humans and Agents

### 12.1 Golden rules (invariants — do not break)

1. **`AppRouter` is the API contract.** It is exported from `apps/backend-node/src/trpc/routers/_app.ts` and imported *by source* in `apps/web/src/utils/trpc.ts` (`../../../backend-node/src/trpc/routers/_app`). Never duplicate the type; never break the relative path. Adding/changing a procedure instantly updates frontend types — run `npm run build:web` to see errors.
2. **Milvus = RESTful v2 on port 9091.** `19530` is gRPC-only. The docker-compose exposes both; do not "fix" `MILVUS_URL` back to 19530.
3. **Every external integration must degrade.** Any call to Mongo, Milvus, rust-core or Solana is wrapped in try/catch with a documented fallback (§14). New integrations must follow this pattern — the stack must boot with *none* of them running.
4. **Determinism is a feature.** Mocks and embeddings are hash-based so the same input yields the same output. Never introduce `Math.random()` into analysis paths.
5. **Response shapes are contracts.** Incident item = `{id, type, severity, location, status, confidence}`. Keep fallback data shape-identical to real data (the UI renders both interchangeably).
6. **Never commit `.env`** (gitignored) and never hardcode secrets in source.
7. **Editing files on Windows:** keep UTF-8. Beware PowerShell `Set-Content` without `-Encoding UTF8` (mojibake for emoji/em-dashes), pre-existing BOMs, and invisible zero-width characters in literals (they once hid inside numeric literals and broke the TS build — scan with a regex for `\u200B–\u200F` if you see bizarre syntax errors).
8. **`npm install` happens at the repo root only** (workspaces). Do not add lockfiles inside workspaces.

### 12.2 Recipe: add a tRPC procedure

1. Add the handler in the relevant router (or create `src/trpc/routers/myRouter.ts` with `export const myRouter = router({ … })`).
2. Register it in `src/trpc/routers/_app.ts` (`myRouter` → key) — this alone updates `AppRouter` and therefore all frontend types.
3. Put business logic in `src/services/myService.ts` (routers stay thin; services are testable and I/O-free where possible).
4. Follow the degradation rule (rule 3) for anything external.
5. Use it in the web app: `trpc.myRouter.myProcedure.useQuery(input)` — full autocomplete, no client codegen.
6. Verify: `npm run typecheck && npm run build:web`, then curl it (§8 formats).

### 12.3 Recipe: change the vision model

Edit only `packages/rust-core/src/vision/model.rs` (`extract_features`) and/or `processor.rs` (`classify`). Keep `POST /analyze → {severity, crisis_type, confidence}` untouched, keep the `fallback_for` path, add unit tests next to the existing ones, and run `cargo test --manifest-path packages/rust-core/Cargo.toml`.

### 12.4 Recipe: real Solana transactions

In `services/solana.ts`, after the `getHealth()` probe succeeds, build the Anchor instruction with `@solana/web3.js` + a funded keypair (env-provided), derive the PDA `[b"crisis", authority]`, send it, and return the real signature. Simulated receipts stay as the offline fallback. Keep the response shape `{authority, crisisType, severity, timestamp, signature}`.

### 12.5 Testing strategy

| Layer | How |
| --- | --- |
| Types | `npm run typecheck` (backend) + `npm run build:web` (catches cross-app type drift) |
| Backend live | Boot `node dist/index.js` (or `npm run dev:backend`) and run the §8 curls — every fallback path is exercisable without infra |
| Rust | `cargo test --manifest-path packages/rust-core/Cargo.toml` (classifier, features, fallback determinism) |
| Anchor | `anchor test` in `packages/solana-program/aether-contracts` |
| Frontend e2e | `npm run dev` + browser: badge, analysis, allocation, wallet, memory search |

## 13. Deployment Guide

Free-tier reference setup: **web on Vercel + API on Render**. Thanks to §14, MongoDB/Milvus are optional even in production.

### 13.1 Backend → Render

1. Push this repo to GitHub (remote `origin` already exists).
2. Render → **New → Web Service** → connect the repo.
3. **Root Directory:** `apps/backend-node` · **Build:** `npm install && npm run build` · **Start:** `npm run start` · **Health Check Path:** `/health`.
4. Environment: `WEB_ORIGIN=https://<your-app>.vercel.app` (exact origin — CORS uses it with credentials), `MONGODB_URI=<Atlas connection string>`, optional `MILVUS_URL`, `SOLANA_RPC_URL=https://api.devnet.solana.com`. Render injects `PORT` and the code honours it.

### 13.2 Dashboard → Vercel

1. Vercel → **Add New Project** → import the same GitHub repo.
2. **Root Directory:** `apps/web` (Vercel detects the workspace root via the repo-root lockfile automatically; if install fails, set Install Command to `npm install` and Build Command to `npm run build`).
3. Environment (build-time): `NEXT_PUBLIC_API_URL=https://<render-service>.onrender.com`, `NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com`.
4. Deploy → share `https://<your-app>.vercel.app`.

### 13.3 Optional data services

- **MongoDB Atlas** (free M0) → connection string → `MONGODB_URI`.
- **Milvus** → Zilliz Cloud serverless or a VM running the same `docker-compose.yml`; expose the **HTTP port** and set `MILVUS_URL`. Skip it initially — the memory search falls back to MongoDB text search automatically.
- **rust-core** → any host that runs Rust (Railway/Fly/VPS); set `RUST_CORE_URL` on Render. Skip it — the deterministic mock keeps the pipeline alive.
- **Solana** → devnet RPC works with simulated receipts until a funded keypair is configured (§12.4).

---

## 14. Operational Degradation

| Service down | Behaviour |
| --- | --- |
| MongoDB | Crises served from seeded sample data; analyses return `mock-…` ids; warning logged |
| Milvus | Vector memory skipped; `searchSimilar` falls back to MongoDB text search; `vectorMemory:false` |
| rust-core | `analyzeSatellite` uses the deterministic Node-side URL-hash mock (identical response shape) |
| Solana validator | `reportCrisis` returns a simulated `sim_…` signature |
| Backend entirely | Dashboard renders with a red **Backend offline** badge |

---

## 15. Troubleshooting

| Symptom | Cause & fix |
| --- | --- |
| `ERR_CONNECTION_REFUSED` on `localhost:3000` | **The dev server is not running.** `localhost` only responds while `npm run dev` (or `npm run dev:web`) is executing. Start it, then reload. |
| Dashboard loads but badge says *Backend offline* | Backend not started or wrong `NEXT_PUBLIC_API_URL`. Check `curl http://localhost:4000/health`. |
| Port already in use (`EADDRINUSE`) | Another process owns 3000/4000/50051. Stop it (`taskkill /F /IM node.exe` on Windows) or change the `PORT` env. |
| Browser console shows tRPC fetch failures | Backend down, or `WEB_ORIGIN` (CORS) doesn't exactly match the frontend origin (credentials mode). |
| Milvus calls always fail | Expected without Docker (`npm run docker:up`). If it's running, remember the REST API lives on **9091**, not 19530. |
| `npm install` prints `npm warn allow-scripts … sharp` | Benign npm install-script policy notice; builds still work. |
| Next build fails fetching Geist font | `next/font/google` needs network access at build time. |
| Anchor build errors | Solana CLI / Anchor 0.32.1 missing, or `~/.config/solana/id.json` wallet absent. |
| Weird TS syntax errors that look fine | Scan the file for invisible characters (`\u200B`–`\u200F`) — see §12.1 rule 7. |

## 16. Roadmap

  * Load real ViT weights into rust-core — the `SatelliteAnalyzer` API is already shaped for it (§12.3)
  * Replace the deterministic embedder with a sentence-transformer + CLIP pairing (keep the 768-dim contract)
  * Real Anchor transactions from `services/solana.ts` once a funded keypair is configured (§12.4)
  * WebSocket push updates instead of 15 s polling
  * Sentinel Hub / NASA GIBS / news ingestion using the reserved API keys in `.env.example`
  * Auth in the tRPC context (the context already carries `req`/`res` for sessions)

## 17. License

MIT — see `package.json`.

---

*Maintained by Saad Salman Akram · built as a blueprint for Agentic AI systems that perceive the physical world (satellite) and act in the financial world (Solana).*