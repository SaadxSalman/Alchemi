"""Builds the Alchemi training dataset (ESOL-style multitask labels).

Combines (a) a curated list of well-known drug/reference molecules with
(b) a combinatorial fragment expansion (scaffolds × linkers × substituents).
For every RDKit-valid molecule it computes RDKit descriptors and an
ESOL-style estimated aqueous solubility (logS), producing:

    data/esol_estimated.csv → smiles, logp, tpsa, mol_wt, logs

Run:  python scripts/build_dataset.py
"""
from __future__ import annotations

import csv
import random
import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from rdkit import Chem, RDLogger  # noqa: E402
from rdkit.Chem import Crippen, Descriptors, Lipinski, rdMolDescriptors  # noqa: E402

from utils import generator  # noqa: E402

RDLogger.DisableLog("rdApp.error")

OUTPUT = SERVICE_ROOT / "data" / "esol_estimated.csv"

KNOWN_MOLECULES = [
    "CC(=O)Oc1ccccc1C(=O)O",            # aspirin
    "CC(C)Cc1ccc(C(C)C(=O)O)cc1",        # ibuprofen
    "CC(=O)Nc1ccc(O)cc1",               # paracetamol
    "Cn1cnc2c1c(=O)n(C)c(=O)n2C",        # caffeine
    "CN(C)C(=N)N=C(N)N",               # metformin
    "OC(=O)c1ccccc1OC(C)C",             # (scaffold variant)
    "COc1ccc2[nH]c(=O)ccc2c1",          # scaffold variant
    "O=C(Nc1cccc(N)c1)c1ccccc1",         # scaffold variant
    "Clc1ccccc1C(=O)Nc1cccc(Cl)c1",      # scaffold variant
    "COc1ccc(cc1)C(=O)NCCN(C)C",         # scaffold variant
    "Fc1ccc(C(=O)Nc2ccc(F)cc2)cc1",      # scaffold variant
    "O=S(=O)(N)c1ccc(Cl)cc1",           # sulfonamide scaffold
    "CC(C)(C)OC(=O)N1CCN(C)CC1",         # Boc-methylpiperazine
    "O=C(Nc1ccccc1)Nc2ccccc2",           # 1,3-diphenylurea
    "Cc1ccc(S(=O)(=O)N)cc1",            # p-toluenesulfonamide
    "OC(=O)C=Cc1ccccc1",                # cinnamic acid
    "O=C(O)c1ccc(O)cc1",                # 4-hydroxybenzoic acid
    "CC(C)Nc1ccc(C(=O)OC)cc1",          # scaffold variant
    "Cn1c(=O)c2c(ncn2C)n(C)c1=O",        # theophylline-ish
    "Clc1ccc(C2CCNCC2)cc1",             # scaffold variant
    "FC(F)(F)c1ccc(C(=O)O)cc1",         # scaffold variant
    "CCOC(=O)c1ccccc1N",                # benzocaine-ish
    "OCC1CN(C)C1",                      # scaffold variant
    "COc1ccccc1OCCN",                   # scaffold variant
    "O=C1CCCN1c1ccccc1",                # scaffold variant
    "CSc1ccccc1",                        # scaffold variant
    "c1ccc(cc1)N1CCOCC1",               # phenylmorpholine
    "O=S(=O)(Nc1ccccc1)c2ccccc2",        # sulfonamide variant
    "C1CCC(N)CC1",                       # cyclohexylamine
    "NC(=O)c1ccc(cc1)N",                # 4-aminobenzamide
]


def _label(mol) -> tuple[str, str, str, str, str] | None:
    try:
        smiles = Chem.MolToSmiles(mol)
        logp = Crippen.MolLogP(mol)
        tpsa = rdMolDescriptors.CalcTPSA(mol)
        mw = Descriptors.MolWt(mol)
        rotb = Lipinski.NumRotatableBonds(mol)
        heavy = mol.GetNumHeavyAtoms()
        ap = sum(1 for a in mol.GetAtoms() if a.GetIsAromatic()) / heavy if heavy else 0.0
        logs = 0.16 - 0.63 * logp - 0.0062 * mw + 0.0062 * rotb - 0.74 * ap
        return (smiles, f"{logp:.4f}", f"{tpsa:.3f}", f"{mw:.3f}", f"{logs:.4f}")
    except Exception:  # noqa: BLE001
        return None


def main() -> None:
    rows: dict[str, tuple] = {}
    # curated known molecules
    for smi in KNOWN_MOLECULES:
        mol = Chem.MolFromSmiles(smi)
        if mol is not None:
            r = _label(mol)
            if r:
                rows[r[0]] = r
    # combinatorial expansion
    rng = random.Random(42)
    attempts = 0
    while len(rows) < 700 and attempts < 8000:
        attempts += 1
        smi = generator._assemble(rng)
        if not smi:
            continue
        mol = Chem.MolFromSmiles(smi)
        if mol is None or mol.GetNumAtoms() < 5 or mol.GetNumAtoms() > 60:
            continue
        r = _label(mol)
        if r:
            rows[r[0]] = r
    out = OUTPUT
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["smiles", "logp", "tpsa", "mol_wt", "logs"])
        for smiles, logp, tpsa, mw, logs in rows.values():
            w.writerow([smiles, logp, tpsa, mw, logs])
    print(f"Wrote {len(rows)} molecules → {out}")


if __name__ == "__main__":
    main()
