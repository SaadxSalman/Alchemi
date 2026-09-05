# Alchemi 🧪⚛️

**An autonomous AI chemistry platform** — agents that design novel molecules, predict synthesis
pathways, and simulate chemical feasibility.

Alchemi leverages a **reaction knowledge graph**, a **GATv2 graph neural
network**, **RDKit cheminformatics**, and optional **LLM reasoning** (LangChain + OpenAI) to propose
novel compounds for drug discovery, material science, and other chemical applications. It works
**fully offline** — every agent falls back to built-in rule-based chemical intelligence when no API
key is configured.

![status](https://img.shields.io/badge/status-functional-brightgreen) ![python](https://img.shields.io/badge/python-3.10%2B-blue) ![node](https://img.shields.io/badge/node-%E2%89%A518.18-green) ![license](https://img.shields.io/badge/license-MIT-yellow)

-----

## ✨ What It Does

| Agent | What it does | Try it at |
|---|---|---|
| 🧬 **Molecule Design Agent** | Generates novel chemical structures from a plain-language objective + property envelope (MW / logP / TPSA targets). Combines LLM-driven design with a **fragment-based generative engine** (12 scaffolds × 18 substituents × 7 linkers), scores every candidate with the GATv2 model, filters Lipinski RO5 + PAINS. | `/design` |
| 🔗 **Reaction Prediction Agent** | Plans **retrosynthetic routes** over a reaction knowledge graph (10 curated reaction templates, 28 commercial building blocks). Returns step-by-step routes with reagents, conditions, confidence and estimated overall yield. | `/pathway` |
| ⚗️ **Simulation Agent** | Validates feasibility of any structure: full RDKit descriptor suite, Lipinski + Veber rules, PAINS/BRENK alerts, **MMFF94 conformer energetics**, and GATv2 multitask property inference (logP / TPSA / logS). | `/simulate` |
| 🗂️ **Molecule Library** | Every designed/saved molecule persists in MongoDB (with an automatic in-memory fallback), searchable and inspectable. | `/library` |

Every agent exposes its **reasoning trace** in the UI — a live "thinking" console showing each
featurization, tool call and observation it made.

-----

## 🏗️ Architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│  FRONTEND · apps/web · Next.js 15 (App Router) + TypeScript        │
│  Tailwind CSS · Shadcn-style UI · TanStack Query · RDKit.js (WASM) │
│  MoleculeViewer · AgentLog · Laboratory Dashboard                  │
└──────────────────────────────┬─────────────────────────────────────┘
                               │  tRPC (end-to-end type-safe) + Zod
┌──────────────────────────────▼─────────────────────────────────────┐
│  BACKEND · apps/server · Node.js (Express) + tRPC v11              │
│  MongoDB (Mongoose) · job orchestration · run history · REST proxy │
└──────────────┬─────────────────────────────────────┬───────────────┘
               │ Axios (AI Bridge)                   │ Mongoose
┌──────────────▼──────────────────────────┐  ┌───────▼───────────────┐
│  AI ENGINE · services/ai-engine         │  │  MongoDB :27017       │
│  FastAPI (Python 3.10+)                 │  │  molecules · runs     │
│  ─ GATv2 (PyTorch Geometric) GNN        │  │  (in-memory fallback  │
│  ─ RDKit featurization & descriptors    │  │   if Mongo is down)   │
│  ─ Reaction knowledge graph (networkx)  │  └───────────────────────┘
│  ─ LangChain + OpenAI (optional)        │
│  ─ Fragment-based generator (offline)   │
└─────────────────────────────────────────┘
```

**Data flow:** the browser calls typed tRPC procedures on Express; Express validates input with
Zod, calls the FastAPI engine over Axios, persists molecules/runs to MongoDB, and returns fully
typed results — the frontend never writes a manual API type.

-----

## 🛠️ Stack

### 💻 1. Frontend (Client Layer) — `apps/web`
* **Next.js 15 (App Router)** – SSR for complex chemical data + SEO
* **TypeScript** – strict type safety between UI and chemical data structures
* **Tailwind CSS + Shadcn-style components** – responsive "Laboratory Dashboard" aesthetic (dark lab theme)
* **RDKit.js (MinimalLib)** – high-fidelity 2D SMILES rendering in the browser, with an automatic server-side RDKit render fallback (`/rest/render`)
* **TanStack Query (React Query v5)** – async state for the agents' "thinking" process
* **tRPC React Query integration** – typed hooks generated straight from the backend router

### 🔗 2. Communication Layer (The Bridge)
* **tRPC v11** – end-to-end type safety: when the Python model defines a new property (e.g. `toxicity_score`), the frontend knows exactly what that data looks like — no manual API documentation
* **Zod** – validates chemical strings (SMILES), agent parameters and property envelopes at the schema boundary

### ⚙️ 3. Backend (Orchestration Layer) — `apps/server`
* **Node.js (Express)** – the "Brain's Secretary": routing, optional API-key auth, run history, persistence
* **MongoDB (Mongoose)** – flexible document store for molecules & agent runs (with graceful **in-memory fallback** so the stack always runs)
* **Axios** – the AI Bridge to the internal Python FastAPI service

### 🧪 4. AI Engine (Intelligence Layer) — `services/ai-engine`
* **FastAPI (Python 3.10+)** – low-latency serving of the models and agents
* **PyTorch Geometric (GATv2)** – 3-layer Graph Attention Network over molecular graphs (atoms = nodes, bonds = edge-featured edges), multitask regression of logP / TPSA / logS
* **RDKit** – featurization, descriptor suite, valence validation, PAINS/BRENK catalogs, 2D rendering, MMFF94 conformers
* **networkx** – the reaction knowledge graph (functional groups ↔ transformations)
* **LangChain + OpenAI** – optional "Agentic Reasoning" and synthesis summaries; built-in rule-based chemical intelligence when offline

### 🏗️ 5. Infrastructure & DevOps
* **Docker & Docker Compose** – one command ships Mongo + AI engine + server + web
* **GitHub Actions** – CI runs Python tests + GATv2 smoke-train + Node typecheck/build/tests on every push
* **Python venv** – isolated AI dependencies; **your `.env` secrets live inside `venv/` which is git-ignored**

-----

## 📂 Project Structure

```text
Alchemi/
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
│   └── server/                     # Backend (Express + tRPC v11 + Mongoose)
│       ├── src/trpc/               # root.ts · trpc.ts · routers/ (agents,
│       │                           #   molecules, runs, health)
│       ├── src/services/           # pythonBridge.ts (Axios → FastAPI)
│       ├── src/repositories/       # Mongo + in-memory fallback stores
│       ├── src/models/             # Mongoose schemas (Molecule, DesignRun)
│       └── src/index.ts            # Server entry (tRPC + REST endpoints)
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
├── .env.example                    # template for all configuration
├── docker-compose.yml              # mongo + ai-engine + server + web
├── package.json                    # root scripts (dev, test, setup)
└── README.md
```

-----
<!-- SECTION-ANCHOR -->

## 🚀 Getting Started

### Prerequisites
* **Node.js ≥ 18.18** (for Next.js + Express)
* **Python 3.10+ — 3.13 recommended** (for the AI engine; 3.13 used in development)
* **MongoDB** *(optional)* — not required; the server auto-falls back to an in-memory store
* **Docker** *(optional)* — for the one-command containerized stack
* **OpenAI API key** *(optional)* — everything works offline without it

### Installation

```bash
git clone https://github.com/SaadxSalman/Alchemi.git
cd Alchemi

# 1) Root tooling (concurrently)
npm install

# 2) Python venv + all AI dependencies (torch CPU, PyG, RDKit, LangChain…)
npm run setup:venv

# 3) Generate the training dataset + train the GATv2 model (~2 min on CPU)
npm run setup:data
npm run setup:train

# 4) Frontend + backend dependencies
npm run install:all

# 5) Configure secrets (see next section)
cp .env.example venv/.env    # then edit venv/.env
```

### 🔐 Configuration — where your secrets live

**All API keys and credentials belong in `venv/.env`.** The `venv/` folder is fully
git-ignored, so your keys can never be pushed to GitHub. All three services load it
automatically (search order: `venv/.env` → service-local `.env` → repo-root `.env`).

```bash
cp .env.example venv/.env
```

Then edit `venv/.env`:

```ini
# Enables LLM reasoning. Leave EMPTY for fully-offline mode.
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# MongoDB (optional — omit to use the in-memory store)
MONGODB_URI=mongodb://localhost:27017/alchemi

# Optional: require an API key for mutating endpoints (sent as x-api-key)
ALCHEMI_API_KEY=

# Where the frontend finds the backend
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
```

> ⚠️ **Never commit real keys.** `.gitignore` blocks `venv/`, `.env`, `.env.*` and common secret
> patterns — only `.env.example` (placeholders only) is tracked.

### Running in development

```bash
# One command — starts AI engine (:8000) + server (:4000) + web (:3000)
npm run dev
```

Or run each tier separately:

```bash
npm run dev:ai        # FastAPI   → http://localhost:8000  (docs at /docs)
npm run dev:server    # Express   → http://localhost:4000
npm run dev:web       # Next.js   → http://localhost:3000
```

### Running with Docker

```bash
docker compose up --build
# web :3000 · server :4000 · ai :8000 · mongo :27017
```

### Production build

```bash
npm run build                        # server (tsc) + web (next build)
npm --prefix apps/server start &
npm --prefix apps/web start
```

-----

<!-- SECTION-ANCHOR -->
## 📡 API Reference

### tRPC (typed, consumed by the frontend) — `http://localhost:4000/trpc`

| Procedure | Type | Description |
|---|---|---|
| `health.check` | query | Server / DB / AI-engine aggregate health |
| `molecules.list` | query | List saved molecules (seeded with examples on first run) |
| `molecules.get` | query | Fetch one molecule by id |
| `molecules.save` | mutation | Validate (via RDKit) + persist a molecule |
| `molecules.delete` | mutation | Remove a molecule |
| `agents.design` | mutation | **Molecule Design Agent** — objective + envelope → ranked novel candidates |
| `agents.predictPathway` | mutation | **Reaction Prediction Agent** — target → retrosynthetic route |
| `agents.simulate` | mutation | **Simulation Agent** — SMILES → descriptors, rules, predictions |
| `runs.list` / `runs.stats` | query | Agent activity history & dashboard statistics |

> When `ALCHEMI_API_KEY` is set in `venv/.env`, all agent mutations require the `x-api-key` header.

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
| `GET /rest/health` | Plain-JSON health probe (curl-friendly) |
| `GET /rest/render?smiles=…&w=&h=` | Server-side RDKit SVG render proxy (used by the UI fallback) |

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

# Server — vitest (tRPC procedures with in-memory store)
npm --prefix apps/server test

# Everything
npm test
```

-----

## 🔒 Security Notes

* `venv/`, all `.env` files, model checkpoints, datasets, logs, builds and `node_modules` are
  **git-ignored** — see `.gitignore` for the full list.
* Only `.env.example` (placeholders) is tracked by git.
* Set `ALCHEMI_API_KEY` in `venv/.env` to require the `x-api-key` header on mutating tRPC
  procedures (useful before exposing the server beyond localhost).
* The AI engine binds to all interfaces inside Docker; keep ports firewalled on shared networks.

-----

## 🧯 Troubleshooting

| Symptom | Fix |
|---|---|
| Frontend shows “AI offline” | Ensure the AI engine is running (`npm run dev:ai`) and check `http://localhost:8000/health` |
| “Database: memory” badge | MongoDB isn’t running — start it (`docker compose up -d mongo`) or set `MONGODB_URI`; in-memory mode still works fully |
| `GATv2` badge missing | Train a checkpoint: `npm run setup:data && npm run setup:train` |
| `torch` install too heavy | Use the CPU build: `pip install torch --index-url https://download.pytorch.org/whl/cpu` |
| Molecule render blank | RDKit.js loads from unpkg CDN; offline, the UI auto-falls back to the server render proxy |
| Port conflicts | Change `PORT` (server), `AI_ENGINE_PORT`, or the Next.js port in `package.json` scripts |

-----

## 🗺️ Roadmap

- [ ] Molecular docking integration (AutoDock Vina)
- [ ] Generative LLM fine-tuned on ChEMBL for de-novo SMILES
- [ ] Multi-step forward-reaction feasibility scoring
- [ ] User accounts + multi-tenant libraries
- [ ] ADMET prediction expansion (hERG, CYP, BBB — GATv2 multitask)
- [ ] Export routes to reaction-SMILES / ELN formats

-----

## 📄 License

MIT — see [LICENSE](./LICENSE).

Built by **Saad Salman** · contributions welcome!

-----
