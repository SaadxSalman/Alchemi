"""FastAPI endpoint tests (TestClient, no external services required)."""
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["service"] == "alchemi-ai-engine"
    assert body["knowledge_graph"]["templates"] >= 8


def test_validate():
    r = client.post("/api/v1/validate", json={"smiles": "CCO"})
    assert r.status_code == 200
    assert r.json()["valid"] is True
    assert r.json()["canonical_smiles"] == "CCO"


def test_featurize():
    r = client.post("/api/v1/featurize", json={"smiles": "CCO"})
    assert r.status_code == 200
    body = r.json()
    assert body["num_nodes"] == 3
    assert body["node_feature_dim"] == 20
    assert body["edge_feature_dim"] == 6


def test_simulation_agent():
    r = client.post("/api/v1/agents/simulation", json={"smiles": "CC(=O)Oc1ccccc1C(=O)O"})
    assert r.status_code == 200
    body = r.json()
    assert body["valid"] is True
    assert body["descriptors"]["molecular_weight"] > 150
    assert len(body["rule_checks"]) >= 6
    assert body["agent_steps"]


def test_simulation_agent_invalid():
    r = client.post("/api/v1/agents/simulation", json={"smiles": "X"})
    assert r.status_code == 200
    assert r.json()["valid"] is False


def test_design_agent():
    r = client.post("/api/v1/agents/molecule-design", json={
        "objective": "brain-penetrant kinase inhibitor",
        "num_candidates": 3,
    })
    assert r.status_code == 200
    body = r.json()
    assert len(body["candidates"]) == 3
    assert body["candidates"][0]["score"] >= body["candidates"][-1]["score"]
    assert body["agent_steps"]


def test_pathway_agent_amide():
    # N-phenylbenzamide is a direct amide-coupling product (benzoic acid + aniline)
    r = client.post("/api/v1/agents/reaction-prediction", json={
        "target_smiles": "O=C(Nc1ccccc1)c1ccccc1", "max_steps": 3,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["valid"] is True
    assert body["is_complete"] is True
    assert body["steps"], "expected at least one reaction step"


def test_pathway_agent_invalid():
    r = client.post("/api/v1/agents/reaction-prediction", json={"target_smiles": "!!"})
    assert r.status_code == 200
    assert r.json()["valid"] is False
