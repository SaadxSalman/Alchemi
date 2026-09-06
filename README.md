# Alchemi 🧪⚛️

**An autonomous AI chemistry platform** — agents that design novel molecules, predict synthesis
pathways, and simulate chemical feasibility.

Alchemi leverages a **reaction knowledge graph**, a **GATv2 graph neural network**, **RDKit
cheminformatics**, and optional **LLM reasoning** (LangChain + OpenAI) to propose novel compounds for
drug discovery, material science, and other chemical applications. Agent runs are processed
asynchronously via **BullMQ** with **Redis** caching, secured by **JWT authentication** and
**API-key protected mutations**. It works **fully offline** — every component degrades gracefully when
optional infrastructure (Redis, MongoDB, OpenAI) is absent.

![status](https://img.shields.io/badge/status-functional-brightgreen) ![python](https://img.shields.io/badge/python-3.10%2B-blue) ![node](https://img.shields.io/badge/node-%E2%89%A518.18-green) ![license](https://img.shields.io/badge/license-MIT-yellow)

-----

## ✨ What It Does

| Agent | What it does | Try it at |
|---|---|---|
| 🧬 **Molecule Design Agent** | Generates novel chemical structures from a plain-language objective + property envelope. Combines LLM-driven design with a **fragment-based generative engine** (12 scaffolds × 18 substituents × 7 linkers), scores every candidate with the GATv2 model, filters Lipinski RO5 + PAINS. | `/design` |
| 🔗 **Reaction Prediction Agent** | Plans **retrosynthetic routes** over a reaction knowledge graph (10 curated reaction templates, 28 commercial building blocks). Returns step-by-step routes with reagents, conditions, confidence and estimated overall yield. | `/pathway` |
| ⚗️ **Simulation Agent** | Validates feasibility of any structure: full RDKit descriptor suite, Lipinski + Veber rules, PAINS/BRENK alerts, **MMFF94 conformer energetics**, and GATv2 multitask property inference. | `/simulate` |
| 🗂️ **Molecule Library** | Every designed/saved molecule persists in MongoDB (with an automatic in-memory fallback), searchable and inspectable. | `/library` |

Every agent exposes its **reasoning trace** in the UI — a live "thinking" console showing each
featurization, tool call and observation it made. Long-running agent calls are enqueued as
background jobs; the UI polls for results automatically.

-----

## 🏗️ Architecture

```
FRONTEND (Next.js 15 + TypeScript + Tailwind + RDKit.js)
    │  tRPC + Zod · x-api-key · Bearer JWT
    ▼
BACKEND (Node.js + Express + tRPC v11)
    │  Helmet · 100 req/min rate limit · Pino logging · JWT auth
    │  BullMQ job queue (sync fallback if Redis absent)
    ├─── Axios ──→ AI ENGINE (FastAPI + GATv2 + RDKit + LangChain)
    ├─── Mongoose ──→ MongoDB :27017 (in-memory fallback)
    └─── ioredis ──→ Redis :6379 (job queue · render cache · no-op fallback)
```

**Data flow:** the browser calls typed tRPC procedures; Express validates with Zod, enqueues agent
jobs to BullMQ (sync fallback if Redis is absent), calls the FastAPI engine over Axios, persists to
MongoDB, and returns typed responses. Redis caches renders; Pino emits structured logs with
request-ID tracing; graceful shutdown on SIGTERM/SIGINT drains everything in order.

-----

## 🛠️ Stack

### 💻 1. Frontend (Client Layer) — `apps/web`
* **Next.js 15 (App Router)** – SSR for complex chemical data + SEO
* **TypeScript + Tailwind CSS** – dark "lab dashboard" theme
* **TanStack Query** – server-state caching + async job polling
* **tRPC React client** – end-to-end type-safe API calls (`@server/*` import alias)
* **RDKit.js (WASM)** – client-side 2D structure rendering (CDN, with server fallback)
* **AgentLog component** – live streaming "thinking" console

### ⚙️ 2. Backend (Orchestration Layer) — `apps/server`
* **Node.js + Express** – HTTP server with Helmet security headers
* **tRPC v11** – end-to-end type-safe routing with Zod validation
* **Mongoose 8** – MongoDB ODM with compound indexes + in-memory fallback
* **BullMQ 5** – Redis-backed job queue for async agent execution (sync fallback)
* **ioredis 5** – Redis client for caching and queue backend (no-op fallback)
* **jsonwebtoken** – HS256 JWT authentication
* **express-rate-limit** – 100 req/min sliding window
* **helmet** – security headers (CSP, HSTS, X-Frame-Options)
* **pino** – structured logging with automatic secret redaction
* **Axios** – typed HTTP bridge to the Python AI engine

### 🧪 3. AI Engine (Python) — `services/ai-engine`
* **FastAPI** – async Python web framework
* **PyTorch + PyTorch Geometric** – GATv2 graph neural network
* **RDKit** – cheminformatics (descriptors, validation, rendering, conformers)
* **networkx** – reaction knowledge graph + retrosynthesis planner
* **LangChain + OpenAI** – optional LLM reasoning with offline fallback
* **Pydantic** – request/response validation

### 🐳 Infrastructure
* **Docker Compose** – MongoDB + Redis + AI Engine + Server + Web
* **GitHub Actions** – CI: train model, run 29+ tests, build both TS apps
* **Python 3.13 venv** – isolated environment holding all secrets

-----

## 🚀 Quickstart

### Prerequisites
* **Python 3.10+** and **Node.js ≥ 18.18**
* (Optional) **Docker** — for MongoDB + Redis

### 1. Clone & install

```bash
git clone https://github.com/SaadxSalman/Alchemi.git
cd Alchemi

# Python environment + AI engine deps
python -m venv venv
venv\Scripts\pip install -r services/ai-engine/requirements.txt   # Windows
# pip install -r services/ai-engine/requirements.txt             # macOS/Linux

# Node deps (root + both apps)
npm run install:all
```

### 2. Configure secrets

Your secrets live in `venv/.env` — **never committed to git** (the entire `venv/` is ignored).

```env
# venv/.env — ALL three services load this automatically

# LLM reasoning (leave empty for fully-offline operation)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# AI Engine
AI_ENGINE_HOST=0.0.0.0
AI_ENGINE_PORT=8000

# Backend
PORT=4000
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/?appName=<cluster>
ALCHEMI_API_KEY=          # set to enable mutation protection
JWT_SECRET=               # set in production
JWT_EXPIRES_IN=7d

# Async Jobs & Cache
REDIS_URL=redis://localhost:6379

# Frontend
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_APP_NAME=Alchemi
NEXT_PUBLIC_ALCHEMI_API_KEY=   # same value as ALCHEMI_API_KEY
```

### 3. Train the GATv2 model (or run without it for heuristics-only)

```bash
npm run setup:data     # build the 700-molecule ESOL dataset
npm run setup:train    # ~2 min on CPU — saves checkpoint to models/checkpoints/
```

### 4. Run everything

```bash
npm run dev
```

This launches all three services concurrently:

| Service | URL | What you'll see |
|---|---|---|
| **Frontend** | http://localhost:3000 | Laboratory dashboard |
| **Backend** | http://localhost:4000 | tRPC + REST API |
| **AI Engine** | http://localhost:8000 | FastAPI + Swagger docs at `/docs` |

> **No Redis or Mongo?** The server starts anyway — jobs run synchronously, caching is a no-op,
> and molecules/runs use an in-memory store. Set `REDIS_URL` / `MONGODB_URI` to enable the full stack.

-----

## 📁 Project Structure

```
├── .github/workflows/main.yml      # CI/CD (Python tests + Node build/test)
├── apps/
│   ├── web/                        # Frontend (Next.js 15 + Tailwind + tRPC client)
│   │   ├── src/app/                # App Router pages (dashboard, design,
│   │   │                           #   pathway, simulate, library) + globals.css
│   │   ├── src/components/         # ui/ · layout/ · molecules/ · agents/
│   │   ├── src/hooks/              # useRDKit (RDKit.js WASM loader)
│   │   ├── src/utils/              # trpc.ts (typed client), misc.ts
│   │   ├── src/types/              # RDKit MinimalLib typings
│   │   ├── next.config.js          # loads secrets from venv/.env
│   │   └── tailwind.config.ts
│   └── server/                     # Backend (Express + tRPC v11 + Mongoose + BullMQ)
│       ├── src/trpc/               # root.ts · trpc.ts · routers/ (agents,
│       │                           #   molecules, runs, health, auth, jobs)
│       ├── src/services/           # pythonBridge.ts (Axios → FastAPI)
│       ├── src/repositories/       # Mongo + in-memory fallback stores
│       ├── src/models/             # Mongoose schemas (Molecule, DesignRun) + indexes
│       ├── src/queue.ts            # BullMQ job queue + sync fallback
│       ├── src/cache.ts            # Redis render/validation cache + no-op fallback
│       ├── src/auth.ts             # JWT register/login + in-memory user store
│       ├── src/logger.ts           # Pino structured logging (pretty in dev, JSON in prod)
│       └── src/index.ts            # Server entry (Helmet · rate limit · tRPC + REST)
├── services/ai-engine/             # Python AI Engine (FastAPI)
│   ├── main.py                     # FastAPI entry (the "Agent" API)
│   ├── train.py                    # GATv2 training script
│   ├── schemas.py                  # Pydantic request/response models
│   ├── config.py                   # settings + venv/.env secret loading
│   ├── agents/                     # molecule_design · reaction_prediction · simulation
│   ├── models/gatv2.py             # the GATv2 network + inference wrapper
│   ├── models/checkpoints/         # trained weights (git-ignored)
│   ├── utils/                      # chemistry · data_loader · generator ·
│   │                               #   reaction_graph · llm_wrapper
│   ├── scripts/build_dataset.py    # generates the ESOL-style training CSV
│   ├── data/                       # dataset CSVs (git-ignored, regenerated)
│   ├── tests/                      # pytest suite (22 tests)
│   ├── requirements.txt
│   └── Dockerfile
├── venv/                           # Python environment + .env SECRETS (git-ignored)
├── docker-compose.yml              # mongo + redis + ai-engine + server + web
├── package.json                    # root scripts: dev · build · test · typecheck
└── LICENSE
```

-----

## 📡 API Reference

### tRPC procedures — `http://localhost:4000/trpc/*`

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `health.check` | query | public | Server / DB / AI aggregate health + queue/cache status |
| `molecules.list` | query | public | List saved molecules (seeded with examples on first run) |
| `molecules.get` | query | public | Fetch one molecule by id |
| `molecules.save` | mutation | x-api-key | Validate (via RDKit) + persist a molecule |
| `molecules.delete` | mutation | x-api-key | Remove a molecule |
| `agents.design` | mutation | x-api-key | **Molecule Design Agent** — enqueue job, returns `jobId` |
| `agents.predictPathway` | mutation | x-api-key | **Reaction Prediction Agent** — enqueue job, returns `jobId` |
| `agents.simulate` | mutation | x-api-key | **Simulation Agent** — enqueue job, returns `jobId` |
| `jobs.get` | query | x-api-key | Poll async job status + result by `jobId` |
| `auth.register` | mutation | public | Create account → returns JWT + user |
| `auth.login` | mutation | public | Authenticate → returns JWT + user |
| `auth.me` | query | Bearer JWT | Current user profile |
| `runs.list` / `runs.stats` | query | public | Agent activity history & dashboard statistics |

> **Auth:** set `ALCHEMI_API_KEY` in `venv/.env` to require the `x-api-key` header on agent
> mutations and job polling. Authenticated routes need `Authorization: Bearer <jwt>`.
> Long-running agent calls are enqueued as BullMQ background jobs; the mutation returns
> immediately with a `jobId` you poll via `jobs.get`. With Redis absent, jobs run synchronously.

### AI Engine REST (FastAPI) — `http://localhost:8000`

| Endpoint | Description |
|---|---|
| `GET /health` | Engine health: torch / GATv2 / LLM / knowledge-graph status |
| `GET /docs` | Interactive OpenAPI/Swagger UI |
| `POST /api/v1/validate` | SMILES validation + canonicalization |
| `POST /api/v1/render` | RDKit 2D structure → SVG |
| `POST /api/v1/featurize` | SMILES → molecular graph (nodes/edges/features) |
| `POST /api/v1/predict/properties` | GATv2 multitask inference vs computed descriptors |
| `POST /api/v1/agents/molecule-design` | Molecule Design Agent |
| `POST /api/v1/agents/reaction-prediction` | Reaction Prediction Agent |
| `POST /api/v1/agents/simulation` | Simulation Agent |
| `GET /api/v1/knowledge-graph/stats` | Knowledge-graph statistics & template list |

### Express REST helpers

| Endpoint | Description |
|---|---|
| `GET /rest/health` | Health: DB mode, AI status, queue/cache availability, uptime |
| `GET /rest/metrics` | Runtime metrics: uptime, memory, DB, queue, cache, users |
| `GET /rest/render?smiles=&w=&h=` | Server-side RDKit SVG render (cached 10 min with Redis) |

-----

## 🧠 The GATv2 Model

Molecules are featurized by RDKit into graphs — **20-dim atom features** (element one-hot,
degree, aromaticity, ring membership, formal charge, H-count) and **6-dim bond features**
(type, conjugation, ring). A 3-layer `GATv2Conv` encoder with edge features, residuals and
layer-norm feeds mean+max graph pooling and an MLP head that regresses three targets:
**logP, TPSA, logS** (ESOL-style solubility).

```bash
python scripts/build_dataset.py    # 700 molecules: curated drugs + fragment expansion
python train.py --epochs 40        # ~2 min on CPU
```

Reference run (700 molecules, 80/10/10 split, CPU): final **val MSE 0.070** (normalized),
test MAE ≈ 0.11 per task. Checkpoint + normalization metadata are saved to
`models/checkpoints/` and hot-loaded by the engine at startup. If no checkpoint (or no torch)
is present, every agent transparently falls back to RDKit/ESOL heuristics.

-----

## ✅ Testing

```bash
# AI engine — 22 pytest tests (descriptors, featurization, generator,
# knowledge graph, all agent endpoints via TestClient)
venv\Scripts\python -m pytest services/ai-engine/tests -q

# Server — 7 vitest tests (tRPC procedures: molecules, runs, health, auth)
npm --prefix apps/server test

# Everything
npm test
```

-----

## 🔒 Security & Production Hardening

* `venv/`, all `.env` files, model checkpoints, datasets, logs, builds and `node_modules` are
  **git-ignored** — see `.gitignore` for the full list.
* **Helmet** sets CSP/HSTS/X-Frame-Options/security headers on every response.
* **Rate limiting** — 100 requests/min per IP on the tRPC surface (skipped in test env).
* **API key** — set `ALCHEMI_API_KEY` to require the `x-api-key` header on agent mutations and job polling.
* **JWT auth** — `JWT_SECRET` signs HS256 tokens (7-day expiry). Use `Authorization: Bearer <jwt>`
  for authenticated routes. Replace the in-memory user store with Mongo/Postgres in production.
* **Graceful shutdown** — SIGTERM/SIGINT drains the BullMQ queue, closes Redis, disconnects Mongo.
* **Pino logging** — secrets (`x-api-key`, `Authorization`, cookies, passwords) are automatically redacted.

-----

## 🧯 Troubleshooting

| Symptom | Fix |
|---|---|
| Frontend shows "AI offline" | Ensure the AI engine is running (`npm run dev:ai`) and check `http://localhost:8000/health` |
| "Database: memory" badge | MongoDB isn't running — start it (`docker compose up -d mongo`) or set `MONGODB_URI` |
| "Queue: false" / "Cache: false" | Redis isn't running — start it (`docker compose up -d redis`). Jobs fall back to sync execution |
| `401 Unauthorized` on agents | Set `ALCHEMI_API_KEY` and pass it as the `x-api-key` header |
| `401` on `auth.me` | Pass a valid JWT: `Authorization: Bearer <token>` from `auth.login` |
| `GATv2` badge missing | Train a checkpoint: `npm run setup:data && npm run setup:train` |
| `torch` install too heavy | Use the CPU build: `pip install torch --index-url https://download.pytorch.org/whl/cpu` |
| Molecule render blank | RDKit.js loads from unpkg CDN; offline, the UI auto-falls back to the server render proxy |
| Port conflicts | Change `PORT` (server), `AI_ENGINE_PORT`, or the Next.js port in scripts |

-----

## 🗺️ Roadmap

- [x] User accounts + JWT authentication
- [x] Async job queue (BullMQ + Redis)
- [x] Redis caching layer
- [x] Production hardening (Helmet, rate limiting, Pino, graceful shutdown)
- [ ] Molecular docking integration (AutoDock Vina)
- [ ] Generative LLM fine-tuned on ChEMBL for de-novo SMILES
- [ ] Multi-step forward-reaction feasibility scoring
- [ ] Multi-tenant libraries (per-user molecule collections)
- [ ] ADMET prediction expansion (hERG, CYP, BBB — GATv2 multitask)
- [ ] Export routes to reaction-SMILES / ELN formats

-----

## 📄 License

MIT — see [LICENSE](./LICENSE).

Built by **Saad Salman** · contributions welcome!

-----