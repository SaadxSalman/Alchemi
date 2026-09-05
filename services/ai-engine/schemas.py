"""Shared Pydantic request/response schemas for the Alchemi AI Engine."""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

AgentStepLevel = Literal["thought", "tool", "observation", "answer"]


class AgentStep(BaseModel):
    step: int
    level: AgentStepLevel = "thought"
    message: str
    detail: str = ""
    duration_ms: int = 0


class PropertyTargets(BaseModel):
    mw_min: float = 150.0
    mw_max: float = 500.0
    logp_min: float = -0.5
    logp_max: float = 5.0
    tpsa_min: float = 20.0
    tpsa_max: float = 140.0
    hbd_max: int = 5
    hba_max: int = 10


class DesignRequest(BaseModel):
    objective: str = Field(min_length=3, max_length=2000)
    num_candidates: int = Field(default=5, ge=1, le=12)
    targets: PropertyTargets = Field(default_factory=PropertyTargets)
    drug_like: bool = True
    avoid_pains: bool = True


class Descriptors(BaseModel):
    smiles: str
    molecular_weight: float
    logp: float
    tpsa: float
    hbd: int
    hba: int
    rotatable_bonds: int
    heavy_atoms: int
    ring_count: int
    aromatic_rings: int
    fraction_csp3: float
    formal_charge: int
    qed: float
    aromatic_proportion: float


class PredictedProperties(BaseModel):
    logp: float
    tpsa: float
    log_solubility: float
    model: str  # e.g. "GATv2 (gatv2_multitask.pt)" or "RDKit heuristic"


class RuleCheck(BaseModel):
    name: str
    passed: bool
    detail: str


class MoleculeAlert(BaseModel):
    source: str  # PAINS / BRENK / NIH
    description: str


class CandidateOut(BaseModel):
    smiles: str
    valid: bool
    score: float
    rank: int = 0
    origin: str  # "llm" | "fragment-generator"
    rationale: str
    descriptors: Descriptors
    predicted: PredictedProperties
    alerts: list[MoleculeAlert] = []
    passes_lipinski: bool = True


class DesignResponse(BaseModel):
    objective: str
    candidates: list[CandidateOut]
    agent_steps: list[AgentStep]
    summary: str
    llm_provider: str
    generator_stats: dict[str, Any] = {}


class SimulateRequest(BaseModel):
    smiles: str


class ConformerInfo(BaseModel):
    generated: bool = False
    energy_kcal_mol: Optional[float] = None
    method: str = "MMFF94"


class SimulationResponse(BaseModel):
    smiles: str
    canonical_smiles: str
    valid: bool
    error: str = ""
    descriptors: Optional[Descriptors] = None
    predicted: Optional[PredictedProperties] = None
    rule_checks: list[RuleCheck] = []
    alerts: list[MoleculeAlert] = []
    conformer: ConformerInfo = Field(default_factory=ConformerInfo)
    drug_likeness_score: float = 0.0
    agent_steps: list[AgentStep] = []
    narrative: str = ""


class PathwayStepOut(BaseModel):
    step: int
    reaction_name: str
    reactants: list[str]
    product: str
    reagents: list[str]
    conditions: str
    confidence: float
    typical_yield: str


class PathwayRequest(BaseModel):
    target_smiles: str
    max_steps: int = Field(default=4, ge=1, le=8)


class PathwayResponse(BaseModel):
    target_smiles: str
    valid: bool
    error: str = ""
    steps: list[PathwayStepOut] = []
    starting_materials: list[str] = []
    overall_confidence: float = 0.0
    estimated_overall_yield: float = 0.0
    is_complete: bool = False
    agent_steps: list[AgentStep] = []
    narrative: str = ""


class ValidateRequest(BaseModel):
    smiles: str


class ValidateResponse(BaseModel):
    valid: bool
    canonical_smiles: str = ""
    error: str = ""
    molecular_weight: float = 0.0


class RenderRequest(BaseModel):
    smiles: str
    width: int = Field(default=420, ge=120, le=1600)
    height: int = Field(default=320, ge=100, le=1600)


class RenderResponse(BaseModel):
    smiles: str
    svg: str


class FeaturizeResponse(BaseModel):
    smiles: str
    canonical_smiles: str
    num_nodes: int
    num_edges: int
    node_feature_dim: int
    edge_feature_dim: int
    node_features: list[list[float]]
    edge_index: list[list[int]]
    edge_features: list[list[float]]


class PredictPropertiesRequest(BaseModel):
    smiles: str


class PredictPropertiesResponse(BaseModel):
    smiles: str
    descriptors: Descriptors
    predicted: PredictedProperties
    computed_vs_predicted: dict[str, float]


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    rdkit_available: bool
    torch_available: bool
    gatv2_loaded: bool
    llm: dict[str, Any]
    knowledge_graph: dict[str, Any]
