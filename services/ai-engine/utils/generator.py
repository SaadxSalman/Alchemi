"""Fragment-based de-novo molecule generator (the Molecule Design Agent's
offline generative engine).

Strategy: combinatorially assemble RDKit-validated molecules from a curated
library of scaffolds × linkers × substituents, then score candidates against
the requested property envelope (Lipinski/GATv2-aware composite score).
"""
from __future__ import annotations

import random
from typing import Optional

from rdkit import Chem
from rdkit.Chem import rdmolops

from utils import chemistry

# Attachment points are written as dummy atoms [*:1], [*:2] ...
SCAFFOLDS: list[tuple[str, str]] = [
    ("benzene", "[*:1]c1ccccc1"),
    ("para-disubstituted benzene", "[*:1]c1ccc([*:2])cc1"),
    ("meta-disubstituted benzene", "[*:1]c1cccc([*:2])c1"),
    ("pyridine", "[*:1]c1cccnc1"),
    ("pyrimidine", "[*:1]c1cncnc1"),
    ("thiophene", "[*:1]c1ccsc1"),
    ("furan", "[*:1]c1ccoc1"),
    ("indole", "[*:1]c1ccc2[nH]ccc2c1"),
    ("quinazoline-like", "[*:1]c1ccc2nccnc2c1"),
    ("cyclohexane", "[*:1]C1CCCCC1"),
    ("piperazine", "[*:1]N1CCNCC1"),
    ("naphthalene", "[*:1]c1cccc2ccccc12"),
]

SUBSTITUENTS: list[tuple[str, str]] = [
    ("methyl", "[*:1]C"),
    ("ethyl", "[*:1]CC"),
    ("isopropyl", "[*:1]C(C)C"),
    ("fluoro", "[*:1]F"),
    ("chloro", "[*:1]Cl"),
    ("trifluoromethyl", "[*:1]C(F)(F)F"),
    ("methoxy", "[*:1]OC"),
    ("hydroxyl", "[*:1]O"),
    ("amine", "[*:1]N"),
    ("dimethylamine", "[*:1]N(C)C"),
    ("carboxamide", "[*:1]C(N)=O"),
    ("sulfonamide", "[*:1]S(N)(=O)=O"),
    ("nitrile", "[*:1]C#N"),
    ("ethoxy", "[*:1]OCC"),
    ("nitro", "[*:1][N+](=O)[O-]"),
    ("acetamide", "[*:1]NC(C)=O"),
    ("morpholine", "[*:1]N1CCOCC1"),
    ("cyclopropyl", "[*:1]C1CC1"),
]

LINKERS: list[tuple[str, str]] = [  # two attachment points
    ("para-phenylene", "[*:1]c1ccc([*:2])cc1"),
    ("ethylene", "[*:1]C[*:2]"),
    ("ether", "[*:1]O[*:2]"),
    ("ethynyl", "[*:1]C#C[*:2]"),
    ("amide", "[*:1]C(=O)N[*:2]"),
    ("sulfonamide", "[*:1]S(=O)(=O)N[*:2]"),
    ("urea", "[*:1]NC(=O)N[*:2]"),
]


def _fill_dummy(mol, frag_smiles: str, map_no: int):
    """Replace dummy atom [*:n] in ``mol`` with ``frag`` (attached at its own dummy)."""
    query = Chem.MolFromSmarts(f"[*:{map_no}]")
    frag = Chem.MolFromSmiles(frag_smiles)
    if query is None or frag is None:
        return None
    products = rdmolops.ReplaceSubstructs(mol, query, frag, replacementConnectionPoint=0)
    if not products:
        return None
    out = Chem.Mol(products[0])
    try:
        Chem.SanitizeMol(out)
    except Exception:  # noqa: BLE001
        return None
    for atom in out.GetAtoms():
        if atom.GetAtomicNum() == 0:
            atom.SetAtomMapNum(0)
    return out


def _assemble(rng: random.Random) -> Optional[str]:
    """Build one candidate molecule: scaffold → linkers/substituents."""
    _, scaffold = rng.choice(SCAFFOLDS)
    mol = Chem.MolFromSmiles(scaffold)
    if mol is None:
        return None
    if rng.random() < 0.35:  # build a two-armed molecule via a linker
        _, linker = rng.choice(LINKERS)
        mol = _fill_dummy(mol, linker, 1)
        if mol is None:
            return None
        _, sub = rng.choice(SUBSTITUENTS)
        mol2 = _fill_dummy(mol, sub, 2)
        if mol2 is not None:
            mol = mol2
    for _ in range(4):  # fill remaining attachment points
        dummies = [a.GetAtomMapNum() for a in mol.GetAtoms() if a.GetAtomicNum() == 0]
        if not dummies:
            break
        _, sub = rng.choice(SUBSTITUENTS)
        filled = _fill_dummy(mol, sub, dummies[0])
        if filled is None:
            return None
        mol = filled
    try:
        ok, cano, _ = chemistry.canonicalize(Chem.MolToSmiles(Chem.RemoveHs(mol)))
        return cano if ok else None
    except Exception:  # noqa: BLE001
        return None


def generate_candidates(n: int, seed: int = 0, max_attempts: int = 500) -> list[dict]:
    """Generate up to ``n`` unique, RDKit-valid candidate molecules."""
    rng = random.Random(seed)
    seen: set[str] = set()
    out: list[dict] = []
    attempts = 0
    while len(out) < n and attempts < max_attempts:
        attempts += 1
        smiles = _assemble(rng)
        if not smiles or smiles in seen:
            continue
        try:
            desc = chemistry.compute_descriptors(smiles)
        except Exception:  # noqa: BLE001
            continue
        seen.add(smiles)
        out.append({"smiles": smiles, "descriptors": desc})
    return out


def score_candidate(
    desc: dict,
    targets: dict,
    drug_like: bool = True,
    alerts: Optional[list[dict]] = None,
) -> float:
    """Composite 0–100 score: property-envelope fit + drug-likeness bonuses."""
    import math

    def band_penalty(value: float, lo: float, hi: float, width: float) -> float:
        if lo <= value <= hi:
            return 0.0
        dist = value - hi if value > hi else lo - value
        return math.exp(-0.5 * (dist / width) ** 2)  # 0..1 penalty

    penalty = (
        band_penalty(desc["molecular_weight"], targets.get("mw_min", 150),
                     targets.get("mw_max", 500), 80)
        + band_penalty(desc["logp"], targets.get("logp_min", -0.5),
                       targets.get("logp_max", 5.0), 1.5)
        + band_penalty(desc["tpsa"], targets.get("tpsa_min", 20),
                       targets.get("tpsa_max", 140), 40)
    )
    score = 100.0 - 26.0 * penalty

    if drug_like:
        score += 8.0 * desc["qed"]
        if (desc["molecular_weight"] <= 500 and desc["logp"] <= 5
                and desc["hbd"] <= 5 and desc["hba"] <= 10):
            score += 6.0  # full Lipinski compliance
        else:
            score -= 10.0
    if alerts:
        score -= 6.0 * min(len(alerts), 3)
    return round(max(0.0, min(100.0, score)), 2)