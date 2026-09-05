"""Alchemi AI Engine — FastAPI entry point (the “Agent” API).

Serves the three autonomous agents (Molecule Design, Reaction Prediction,
Simulation) plus cheminformatics utilities (featurization, validation,
rendering, property inference) to the Express orchestration layer.

Run:  python main.py   or   uvicorn main:app --port 8000
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from agents import molecule_design, reaction_prediction, simulation
from config import settings
from models import get_predictor, runtime_info
from schemas import (
    DesignRequest, FeaturizeResponse, PathwayRequest, PredictPropertiesRequest,
    RenderRequest, SimulateRequest, ValidateRequest,
)
from utils import chemistry, data_loader, reaction_graph
from utils.llm_wrapper import llm

logging.basicConfig(
    level=getattr(logging, settings.log_level, logging.INFO),
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("alchemi")

AGENTS = [
    {"id": "molecule-design", "name": "Molecule Design Agent",
     "endpoint": "/api/v1/agents/molecule-design",
     "description": "Generates novel chemical structures from an objective + property envelope "
                    "using LLM reasoning and a fragment-based generative engine, scored by GATv2."},
    {"id": "reaction-prediction", "name": "Reaction Prediction Agent",
     "endpoint": "/api/v1/agents/reaction-prediction",
     "description": "Plans retrosynthetic routes over the reaction knowledge graph and proposes "
                    "viable synthesis pathways with reagents and conditions."},
    {"id": "simulation", "name": "Simulation Agent",
     "endpoint": "/api/v1/agents/simulation",
     "description": "Models molecular properties and behavior (descriptors, Lipinski/Veber, PAINS, "
                    "MMFF conformers, GATv2 inference) to validate feasibility."},
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_predictor()  # warm-load GATv2 checkpoint
    log.info("Alchemi AI Engine ready · %s", settings.public_summary())
    yield


app = FastAPI(
    title="Alchemi AI Engine",
    version="1.0.0",
    description="Autonomous molecule design, reaction prediction and chemical simulation "
                "for the Alchemi (Chem-Agent) platform.",
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health() -> dict:
    info = runtime_info()
    return {
        "status": "ok" if info["torch_available"] else "degraded",
        "service": "alchemi-ai-engine",
        "version": app.version,
        "rdkit_available": True,
        "torch_available": info["torch_available"],
        "gatv2_loaded": info["gatv2_loaded"],
        "llm": {"provider": "openai" if llm.available else "offline-fallback",
                "model": settings.openai_model if llm.available else "rule-based-chem-engine"},
        "knowledge_graph": reaction_graph.kg_stats(),
        "env_file": str(settings.env_file) if settings.env_file else None,
    }


@app.get("/api/v1/agents")
def list_agents() -> dict:
    return {"agents": AGENTS, "knowledge_graph": reaction_graph.kg_stats()}


@app.post("/api/v1/validate")
def validate(req: ValidateRequest) -> dict:
    ok, canon, err = chemistry.canonicalize(req.smiles)
    mw = chemistry.compute_descriptors(canon)["molecular_weight"] if ok else 0.0
    return {"valid": ok, "canonical_smiles": canon, "error": err, "molecular_weight": mw}


@app.post("/api/v1/render")
def render(req: RenderRequest) -> dict:
    try:
        svg = chemistry.render_svg(req.smiles, req.width, req.height)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"smiles": req.smiles, "svg": svg}


@app.post("/api/v1/featurize")
def featurize(req: ValidateRequest) -> dict:
    try:
        g = data_loader.mol_to_graph(req.smiles)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "smiles": req.smiles,
        "canonical_smiles": g["canonical_smiles"],
        "num_nodes": g["num_nodes"],
        "num_edges": g["num_edges"],
        "node_feature_dim": data_loader.FEATURE_DIM,
        "edge_feature_dim": data_loader.EDGE_DIM,
        "node_features": g["node_features"],
        "edge_index": g["edge_index"],
        "edge_features": g["edge_features"],
    }


@app.post("/api/v1/predict/properties")
def predict_properties(req: PredictPropertiesRequest) -> dict:
    try:
        desc = chemistry.compute_descriptors(req.smiles)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    predictor = get_predictor()
    if predictor is not None:
        p = predictor.predict([desc["smiles"]])[0]
        predicted = {"logp": p["logp"], "tpsa": p["tpsa"],
                     "log_solubility": p["log_solubility"], "model": p["model"]}
    else:
        predicted = {"logp": desc["logp"], "tpsa": desc["tpsa"],
                     "log_solubility": chemistry.estimate_solubility(desc),
                     "model": "RDKit heuristic"}
    return {
        "smiles": req.smiles,
        "descriptors": desc,
        "predicted": predicted,
        "computed_vs_predicted": {
            "logp": round(desc["logp"] - predicted["logp"], 3),
            "tpsa": round(desc["tpsa"] - predicted["tpsa"], 2),
            "log_solubility": round(
                chemistry.estimate_solubility(desc) - predicted["log_solubility"], 3),
        },
    }


@app.post("/api/v1/agents/molecule-design")
def agent_design(req: DesignRequest) -> dict:
    try:
        return molecule_design.run_design(req).model_dump()
    except Exception as exc:  # noqa: BLE001
        log.exception("Design agent failed")
        raise HTTPException(status_code=500, detail=f"Design agent error: {exc}") from exc


@app.post("/api/v1/agents/reaction-prediction")
def agent_pathway(req: PathwayRequest) -> dict:
    try:
        return reaction_prediction.run_pathway(req).model_dump()
    except Exception as exc:  # noqa: BLE001
        log.exception("Reaction agent failed")
        raise HTTPException(status_code=500, detail=f"Reaction agent error: {exc}") from exc


@app.post("/api/v1/agents/simulation")
def agent_simulation(req: SimulateRequest) -> dict:
    try:
        return simulation.run_simulation(req).model_dump()
    except Exception as exc:  # noqa: BLE001
        log.exception("Simulation agent failed")
        raise HTTPException(status_code=500, detail=f"Simulation agent error: {exc}") from exc


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=False)