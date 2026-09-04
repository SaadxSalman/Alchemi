# Aether-Agent 🌍🤝

An AI agent designed to revolutionize humanitarian crisis response. Aether-Agent analyzes real-time satellite imagery, social media data, and news reports to detect natural disasters, predict the needs of affected communities, and coordinate a rapid and effective response.

-----

## ✨ Features

  * **Autonomous Crisis Detection** — the **Monitoring Agent** classifies satellite imagery into crisis types (Flood, Wildfire, Earthquake, …) with severity + confidence, and persists incidents to MongoDB.
  * **Intelligent Resource Allocation** — the **Resource Allocation Agent** converts a crisis into a concrete, auditable aid package (water, meals, medical / shelter / hygiene kits) with a computed priority level.
  * **On-the-Ground Coordination** — the **Communication Agent** records crisis reports on **Solana** through the `aether-contracts` Anchor program (PDA per authority, updateable record).
  * **Satellite Vision Analysis** — the **Rust core** downloads each image, extracts luminance / colour-dominance / texture features (a pure-Rust stand-in for the Vision Transformer) and classifies the damage.
  * **Multi-Modal Data Synthesis** — every analysis is embedded into a 768-dim vector (image + text) and stored in **Milvus**, so past crises can be recalled by similarity search; falls back to MongoDB text search.
  * **Typed End-to-End** — the Next.js dashboard talks to the orchestrator over **tRPC**, importing the `AppRouter` type straight from the backend source. No REST clients, no stale DTOs.
  * **Zero-Config Resilience** — MongoDB, Milvus, the Rust core and Solana are all *optional at runtime*; the stack degrades gracefully (see [Operational Degradation](#-operational-degradation)) and never crashes because an optional service is down.

-----

## ⚙️ Tech Stack

To build a world-class humanitarian tool like **Aether-Agent**, you are using a "Safety-First, Performance-Driven" stack. By combining **Rust's** computational efficiency with **Node.js's** developer velocity and **Solana's** transparency, you've created a system that is both fast enough for real-time disaster tracking and secure enough for global aid distribution.

### 🛠️ The Comprehensive Aether-Agent Tech Stack

| Layer | Technology | Why it's being used |
| --- | --- | --- |
| **Frontend** | **Next.js 16 (App Router)** | Provides high SEO for public crisis reports and fast, server-side rendering for data-heavy dashboards. |
|  | **Tailwind CSS** | Used for rapid, responsive UI development (crucial for field workers on mobile devices). |
|  | **TypeScript + tRPC + React Query** | Ensures end-to-end type safety and polling-based "real-time" dashboards without a socket server. |
| **Backend** | **Node.js (Express)** | Acts as the "Orchestrator," managing user sessions and routing requests between AI and Blockchain. |
|  | **tRPC** | Provides a "Zero-API" feel by sharing types between the backend and frontend automatically. |
|  | **Rust (Axum)** | The high-performance engine for heavy CPU tasks like image processing and vector math. |
| **Databases** | **Milvus (Vector DB)** | Stores multi-modal embeddings from satellite images and news text for rapid similarity search (RESTful v2 API on port 9091). |
|  | **MongoDB** | Stores traditional relational data like user profiles, crisis history, and logistics metadata. |
| **Intelligence** | **Vision features (ViT-ready)** | Extracts luminance, colour dominance and texture variance from satellite patches; swap in real ViT weights without touching the API. |
|  | **Multi-Modal Embeddings** | Maps images and text into a single 768-dim space so "flood photos" and "flood reports" can be compared. |
| **Blockchain** | **Solana** | Chosen for its high throughput and low fees, making it viable for recording micro-aid transactions. |
|  | **Anchor Framework** | The "Gold Standard" for writing secure Solana programs in Rust. |
| **DevOps** | **Docker & Compose** | Ensures the entire stack (Milvus, Mongo, Node) runs identically on your machine and in production. |

---

### 💡 Why this stack works

1. **The "Rust-Bridge":** By writing your AI logic in Rust but your API in Node.js, you get the memory efficiency of a pure Python/Node stack without sacrificing ease of use for the frontend.
2. **Solana's Speed:** Unlike Ethereum, Solana allows your agent to record crisis data on-chain in sub-second time, which is vital when minutes matter in a humanitarian emergency.
3. **Milvus for Memory:** Traditional databases can't "search" an image. Milvus allows your agent to have a "visual memory" of past disasters to better predict the needs of current ones.

This stack represents the cutting edge of **Agentic AI**. You are moving away from simple "chatbots" toward autonomous systems that can perceive the physical world (via satellite) and act in the financial world (via Solana).

-----

## 🚀 Getting Started

### Prerequisites

| Tool | Required? | Used for |
| --- | --- | --- |
| **Node.js ≥ 20** + npm | ✅ required | Backend orchestrator + Next.js dashboard |
| **Docker** | optional | MongoDB, Milvus, etcd, MinIO containers |
| **Rust ≥ 1.75** (cargo) | optional | The rust-core vision/analysis service |
| **Solana CLI + Anchor ≥ 0.32** | optional | Building & deploying the on-chain program |

> Every optional service degrades gracefully — the full stack runs with **only Node.js installed**.

### Installation

1.  **Install dependencies** (npm workspaces hoist everything to the repo root):
    ```bash
    npm install
    ```
2.  **(Optional) Start the infrastructure containers** — MongoDB + Milvus + etcd + MinIO:
    ```bash
    npm run docker:up        # docker compose up -d
    ```
3.  **(Optional) Build & run the Rust AI core:**
    ```bash
    npm run build:rust       # cargo build --release
    npm run run:rust         # serves http://localhost:50051
    ```
    Without it, the backend substitutes a deterministic mock analysis so the UI still works end-to-end.
4.  **(Optional) Build the Solana program** (requires Solana CLI + Anchor):
    ```bash
    cd packages/solana-program/aether-contracts
    anchor build             # then: anchor deploy (localnet)
    ```
    Without a validator, on-chain logging returns simulated receipts.
5.  **Run the full stack:**
    ```bash
    npm run dev              # backend (:4000) + web (:3000), concurrently
    ```
    Then open **http://localhost:3000** 🎉

### Configuration

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Backend orchestrator port |
| `WEB_ORIGIN` | `http://localhost:3000` | CORS origin for the dashboard |
| `MONGODB_URI` | `mongodb://localhost:27017/aether-agent` | Crisis history store |
| `RUST_CORE_URL` | `http://localhost:50051` | Rust AI core endpoint |
| `MILVUS_URL` | `http://localhost:9091` | Milvus **RESTful v2** API (HTTP port, not gRPC 19530) |
| `SOLANA_RPC_URL` | `http://127.0.0.1:8899` | Solana RPC endpoint |
| `SOLANA_PROGRAM_ID` | (deployed program) | aether-contracts program address |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Backend URL baked into the web bundle |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Wallet balance lookups in the browser |

### Usage

1. Open the dashboard — the stats row and **Active incidents** list come from `monitor.getStats` / `monitor.getActiveCrises` (seeded sample data until MongoDB is up).
2. Paste a satellite image URL into **Analyze satellite image** and submit → the Monitoring Agent classifies it, stores it, and embeds it into Milvus' vector memory.
3. The **Resource allocation** panel predicts the aid package (water, meals, kits) for the most severe active crisis.
4. Click **Connect Wallet** (e.g. Phantom) and then **Log Crisis On-Chain** to record the crisis on Solana — the receipt (signature) is shown in-place and stored on the crisis record.
5. Use **Multi-modal memory** to search past crises by free text ("flood damage reports") — served by Milvus similarity search, or MongoDB text search when Milvus is offline.

-----

## 🔌 API Surface

The orchestrator exposes tRPC at **`http://localhost:4000/trpc`** (batch link) and a REST health probe at **`/health`**.

| Router | Procedure | Type | Description |
| --- | --- | --- | --- |
| `monitor` | `getActiveCrises` | query | Active incidents (MongoDB, seeded fallback) |
| `monitor` | `getStats` | query | Dashboard counters (active / critical / most common type) |
| `monitor` | `analyzeSatellite` | mutation | Full Vision pipeline → verdict + persistence + vector memory |
| `monitor` | `searchSimilar` | query | Multi-modal similarity search (Milvus → MongoDB fallback) |
| `allocation` | `estimateNeeds` | query | Resource Allocation Agent — aid package for a crisis |
| `solana` | `health` | query | Cluster reachability + program ID |
| `solana` | `reportCrisis` | mutation | Record a crisis on-chain (simulated without validator) |

-----

## 🩹 Operational Degradation

| Service down | Behaviour |
| --- | --- |
| MongoDB | Crises are served from seeded sample data; analyses return mock IDs; warning logged |
| Milvus | Vector memory is skipped; `searchSimilar` falls back to MongoDB text search |
| rust-core | `analyzeSatellite` uses a deterministic URL-hash mock (same output contract) |
| Solana validator | `reportCrisis` returns a simulated signature prefixed `sim_` |
| Backend entirely | Dashboard shows a red **Backend offline** badge |

-----

## 📂 File Structure

```text
Aether-Agent/
├── apps/
│   ├── web/                          # Next.js 16 (Frontend)
│   │   ├── src/
│   │   │   ├── app/                  # App Router (page, layout, providers)
│   │   │   ├── components/           # AidDashboard, MemorySearch, WalletButton
│   │   │   ├── hooks/                # useTRPC (typed client + health), useSolana
│   │   │   └── utils/                # trpc.ts (client setup + API base)
│   │   └── public/                   # Assets
│   └── backend-node/                 # Express (Orchestrator)
│       ├── src/
│       │   ├── trpc/                 # tRPC routers: monitor, solana, allocation
│       │   ├── services/             # db, milvus (REST v2), rustCore, solana,
│       │   │                         # embeddings, allocation
│       │   ├── models/               # MongoDB Schemas (Mongoose)
│       │   └── index.ts              # Entry point
│       └── tsconfig.json
├── packages/
│   ├── rust-core/                    # AI & Vision heavy lifting (Axum)
│   │   ├── src/
│   │   │   ├── vision/               # Feature extraction (ViT stand-in)
│   │   │   ├── processor.rs          # Crisis classification + fallback
│   │   │   ├── lib.rs                # Library root (unit-tested)
│   │   │   └── main.rs               # Axum server: POST /analyze, GET /health
│   │   └── Cargo.toml
│   └── solana-program/aether-contracts/  # Blockchain Coordination
│       ├── programs/aether-agent/    # Anchor program: report_crisis (PDA)
│       ├── tests/                    # ts-mocha integration tests
│       ├── Anchor.toml               # localnet config (npm)
│       └── package.json
├── docker-compose.yml                # MongoDB, Milvus, MinIO, etcd
├── .env.example                      # Template for all environment variables
├── package.json                      # Root workspace config + scripts
└── README.md
```

-----

## 🧪 Development Scripts

| Command | Action |
| --- | --- |
| `npm run dev` | Backend + web concurrently (colour-coded logs) |
| `npm run dev:backend` / `npm run dev:web` | Individual services |
| `npm run build` | Build backend (`tsc`) then web (`next build`) |
| `npm run typecheck` | TypeScript strict check of the backend |
| `npm run build:rust` / `npm run run:rust` | Build / run the Rust AI core |
| `npm run docker:up` / `npm run docker:down` | Start / stop MongoDB + Milvus stack |

## 🗺️ Roadmap

  * Load real ViT weights into `rust-core` (the `SatelliteAnalyzer` API is already shaped for it).
  * Swap the deterministic embedder for a sentence-transformer + CLIP pairing.
  * Real transaction construction in `services/solana.ts` once a funded keypair is configured.
  * WebSocket push updates instead of 15s polling.
  * Sentinel Hub / NASA GIBS ingestion using the optional API keys in `.env.example`.

## 📄 License

MIT — see [package.json](package.json).