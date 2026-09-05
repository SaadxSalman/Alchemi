"""Unit tests for RDKit chemistry helpers."""
from utils import chemistry


def test_canonicalize_valid():
    ok, cano, err = chemistry.canonicalize("CC(=O)Oc1ccccc1C(=O)O")
    assert ok and cano == "CC(=O)Oc1ccccc1C(=O)O" and err == ""


def test_canonicalize_invalid():
    ok, cano, err = chemistry.canonicalize("not-a-molecule")
    assert not ok and err


def test_descriptors_aspirin():
    d = chemistry.compute_descriptors("CC(=O)Oc1ccccc1C(=O)O")
    assert 178 < d["molecular_weight"] < 182  # aspirin ≈ 180.16
    assert 1 <= d["logp"] <= 3
    assert d["hbd"] == 1 and d["hba"] >= 3


def test_lipinski_aspirin_passes():
    d = chemistry.compute_descriptors("CC(=O)Oc1ccccc1C(=O)O")
    assert all(c["passed"] for c in chemistry.lipinski_checks(d))


def test_estimate_solubility_reasonable():
    d = chemistry.compute_descriptors("CC(=O)Oc1ccccc1C(=O)O")
    log_s = chemistry.estimate_solubility(d)
    assert -5 < log_s < 2


def test_render_svg():
    svg = chemistry.render_svg("c1ccccc1", 300, 200)
    assert "<svg" in svg and "</svg>" in svg


def test_tanimoto_similarity():
    same = chemistry.tanimoto("CCO", "CCO")
    diff = chemistry.tanimoto("CCO", "c1ccccc1")
    assert same == 1.0 and diff < 1.0
