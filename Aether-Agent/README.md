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

<!-- __CHUNK4__ -->