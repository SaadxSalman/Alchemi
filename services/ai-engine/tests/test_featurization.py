"""Featurization / generator / reaction-graph unit tests."""
from utils import data_loader, generator, reaction_graph


def test_graph_features_aspirin():
    g = data_loader.mol_to_graph("CC(=O)Oc1ccccc1C(=O)O")
    assert g["num_nodes"] == 13
    assert g["num_edges"] == 26  # bidirectional edges
    assert len(g["node_features"][0]) == data_loader.FEATURE_DIM == 20
    assert len(g["edge_features"][0]) == data_loader.EDGE_DIM == 6


def test_graph_features_single_atom():
    g = data_loader.mol_to_graph("[Na+]")
    assert g["num_nodes"] == 1


def test_generator_produces_valid_unique():
    cands = generator.generate_candidates(12, seed=7)
    assert len(cands) >= 8
    smiles = {c["smiles"] for c in cands}
    assert len(smiles) == len(cands)


def test_score_candidate_bounds():
    desc = {"molecular_weight": 300, "logp": 2.0, "tpsa": 60, "hbd": 1, "hba": 4, "qed": 0.7}
    score = generator.score_candidate(desc, {"mw_min": 150, "mw_max": 500,
                                             "logp_min": -0.5, "logp_max": 5,
                                             "tpsa_min": 20, "tpsa_max": 140})
    assert 0 <= score <= 100 and score > 50


def test_kg_stats():
    stats = reaction_graph.kg_stats()
    assert stats["templates"] >= 8
    assert stats["building_blocks"] >= 20
    assert stats["nodes"] > 0 and stats["edges"] > 0


def test_plan_amide_route():
    plan = reaction_graph.plan_synthesis("O=C(Nc1ccccc1)c1ccccc1", max_steps=3)
    assert plan is not None and plan["complete"]
    assert plan["steps"][0]["reaction_name"] == "Amide coupling"
    assert plan["starting_materials"]


def test_retro_smarts_all_compile():
    for tpl in reaction_graph.REACTION_TEMPLATES:
        assert tpl.compiled_retro() is not None
        assert tpl.compiled() is not None
