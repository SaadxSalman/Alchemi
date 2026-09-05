"""RDKit-powered chemistry helpers shared by every Alchemi agent.

Everything here is pure cheminformatics (no torch / no network), so the
engine degrades gracefully even without the GNN or an LLM key.
"""
from __future__ import annotations

import logging
from typing import Optional

from rdkit import Chem, RDLogger
from rdkit.Chem import Crippen, Descriptors as RDDescriptors, Lipinski, QED, rdMolDescriptors
from rdkit.Chem.Draw import rdMolDraw2D
from rdkit import DataStructs
from rdkit.Chem import rdFingerprintGenerator

RDLogger.DisableLog("rdApp.warning")
log = logging.getLogger("alchemi.chemistry")

# ── Descriptor computation ──────────────────────────────────────────────────

def canonicalize(smiles: str) -> tuple[bool, str, str]:
    """Return (valid, canonical_smiles, error)."""
    try:
        mol = Chem.MolFromSmiles(smiles.strip())
        if mol is None:
            return False, "", "RDKit could not parse SMILES (syntax or valence error)"
        if mol.GetNumAtoms() == 0:
            return False, "", "Empty molecule"
        cano = Chem.MolToSmiles(mol)
        return True, cano, ""
    except Exception as exc:  # noqa: BLE001
        return False, "", f"Validation error: {exc}"


def compute_descriptors(smiles: str) -> dict:
    """Full RDKit descriptor suite used across agents and the UI."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: {smiles!r}")
    mw = RDDescriptors.MolWt(mol)
    logp = Crippen.MolLogP(mol)
    tpsa = rdMolDescriptors.CalcTPSA(mol)
    hbd = Lipinski.NumHDonors(mol)
    hba = Lipinski.NumHAcceptors(mol)
    rotb = Lipinski.NumRotatableBonds(mol)
    rings = rdMolDescriptors.CalcNumRings(mol)
    aromatic_rings = rdMolDescriptors.CalcNumAromaticRings(mol)
    heavy = mol.GetNumHeavyAtoms()
    fsp3 = rdMolDescriptors.CalcFractionCSP3(mol)
    charge = Chem.GetFormalCharge(mol)
    qed = QED.qed(mol)
    aromatic_proportion = 0.0
    if heavy > 0:
        aromatic_atoms = sum(1 for a in mol.GetAtoms() if a.GetIsAromatic())
        aromatic_proportion = aromatic_atoms / heavy
    return {
        "smiles": Chem.MolToSmiles(mol),
        "molecular_weight": round(mw, 2),
        "logp": round(logp, 3),
        "tpsa": round(tpsa, 2),
        "hbd": int(hbd),
        "hba": int(hba),
        "rotatable_bonds": int(rotb),
        "heavy_atoms": int(heavy),
        "ring_count": int(rings),
        "aromatic_rings": int(aromatic_rings),
        "fraction_csp3": round(fsp3, 3),
        "formal_charge": int(charge),
        "qed": round(qed, 3),
        "aromatic_proportion": round(aromatic_proportion, 3),
    }


# ── Solubility estimate (Delaney / ESOL-style regression) ───────────────────

def estimate_solubility(descriptors: dict) -> float:
    """ESOL-style estimated log(S) (mol/L) from computed descriptors.

    Coefficients follow the published Delaney regression:
        logS = 0.16 - 0.63*logP - 0.0062*MW + 0.0062*RB - 0.74*AP
    """
    return round(
        0.16
        - 0.63 * descriptors["logp"]
        - 0.0062 * descriptors["molecular_weight"]
        + 0.0062 * descriptors["rotatable_bonds"]
        - 0.74 * descriptors["aromatic_proportion"],
        3,
    )


# ── Medicinal-chemistry rules & alerts ──────────────────────────────────────

def lipinski_checks(d: dict) -> list[dict]:
    return [
        {"name": "MW ≤ 500 Da", "passed": d["molecular_weight"] <= 500,
         "detail": f"MW = {d['molecular_weight']}"},
        {"name": "logP ≤ 5", "passed": d["logp"] <= 5,
         "detail": f"logP = {d['logp']}"},
        {"name": "H-bond donors ≤ 5", "passed": d["hbd"] <= 5,
         "detail": f"HBD = {d['hbd']}"},
        {"name": "H-bond acceptors ≤ 10", "passed": d["hba"] <= 10,
         "detail": f"HBA = {d['hba']}"},
    ]


def veber_checks(d: dict) -> list[dict]:
    return [
        {"name": "Rotatable bonds ≤ 10 (Veber)", "passed": d["rotatable_bonds"] <= 10,
         "detail": f"RB = {d['rotatable_bonds']}"},
        {"name": "TPSA ≤ 140 Å² (Veber)", "passed": d["tpsa"] <= 140,
         "detail": f"TPSA = {d['tpsa']}"},
    ]


_PAINS_CATALOG: Optional[object] = None
_BRENK_CATALOG: Optional[object] = None


def _catalog(params_flag):
    try:
        from rdkit.Chem.FilterCatalog import FilterCatalog, FilterCatalogParams
        params = FilterCatalogParams()
        params.AddCatalog(params_flag)
        return FilterCatalog(params)
    except Exception as exc:  # noqa: BLE001
        log.debug("FilterCatalog unavailable: %s", exc)
        return None


def structural_alerts(smiles: str) -> list[dict]:
    """PAINS / BRENK structural alert screening (best-effort)."""
    global _PAINS_CATALOG, _BRENK_CATALOG
    try:
        from rdkit.Chem.FilterCatalog import FilterCatalogParams
        pains_flag = FilterCatalogParams.FilterCatalogs.PAINS
        brenk_flag = FilterCatalogParams.FilterCatalogs.BRENK
    except Exception:  # noqa: BLE001
        return []
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return []
    alerts: list[dict] = []
    for source, flag in (("PAINS", pains_flag), ("BRENK", brenk_flag)):
        if source == "PAINS" and _PAINS_CATALOG is None:
            _PAINS_CATALOG = _catalog(flag)
        if source == "BRENK" and _BRENK_CATALOG is None:
            _BRENK_CATALOG = _catalog(flag)
        cat = _PAINS_CATALOG if source == "PAINS" else _BRENK_CATALOG
        if cat is None:
            continue
        try:
            for entry in cat.GetMatches(mol):
                alerts.append({"source": source, "description": entry.GetDescription()})
                if len(alerts) >= 10:
                    return alerts
        except Exception as exc:  # noqa: BLE001
            log.debug("Alert screening failed for %s: %s", smiles, exc)
    return alerts


# ── Fingerprints (diversity / similarity) ───────────────────────────────────

_MORGAN_GEN = rdFingerprintGenerator.GetMorganGenerator(radius=2, fpSize=2048)


def morgan_fp(smiles: str):
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    return _MORGAN_GEN.GetFingerprint(mol)


def tanimoto(smiles_a: str, smiles_b: str) -> float:
    fa, fb = morgan_fp(smiles_a), morgan_fp(smiles_b)
    if fa is None or fb is None:
        return 0.0
    return DataStructs.TanimotoSimilarity(fa, fb)


# ── 2D rendering (server-side RDKit → SVG) ──────────────────────────────────

def render_svg(smiles: str, width: int = 420, height: int = 320) -> str:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: {smiles!r}")
    drawer = rdMolDraw2D.MolDraw2DSVG(width, height)
    opts = drawer.drawOptions()
    opts.clearBackground = True
    rdMolDraw2D.PrepareAndDrawMolecule(drawer, mol)
    drawer.FinishDrawing()
    return drawer.GetDrawingText()
