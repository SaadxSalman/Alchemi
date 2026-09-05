"""RDKit → molecular-graph featurization for the GATv2 engine.

Molecules are represented as PyTorch Geometric ``Data`` objects:
  • nodes = atoms   (20-dim feature vector, see ``atom_features``)
  • edges = bonds   (6-dim feature vector, see ``bond_features``)

The pure-python graph extraction (``mol_to_graph``) has no torch
dependency, so it can also power the ``/api/v1/featurize`` endpoint and
unit tests even if torch is unavailable.
"""
from __future__ import annotations

import csv
from typing import Optional, Sequence

from rdkit import Chem

# ── Feature specification (must match models/gatv2.py & checkpoints) ────────
ATOM_SYMBOLS = ["C", "N", "O", "S", "P", "F", "Cl", "Br", "I"]
BOND_TYPES = [Chem.rdchem.BondType.SINGLE, Chem.rdchem.BondType.DOUBLE,
              Chem.rdchem.BondType.TRIPLE, Chem.rdchem.BondType.AROMATIC]

FEATURE_DIM = len(ATOM_SYMBOLS) + 4 + 1 + 1 + 1 + 4  # 20
EDGE_DIM = 4 + 1 + 1  # 6

try:  # torch is optional at import time (graceful degradation)
    import torch
    from torch_geometric.data import Data, InMemoryDataset  # noqa: F401
    TORCH_AVAILABLE = True
except Exception:  # noqa: BLE001
    torch = None  # type: ignore[assignment]
    Data = None  # type: ignore[assignment]
    TORCH_AVAILABLE = False


def _onehot(value, choices) -> list[float]:
    return [1.0 if value == c else 0.0 for c in choices]


def atom_features(atom: Chem.Atom) -> list[float]:
    """20-dim atom feature vector."""
    symbol = atom.GetSymbol()
    degree = min(atom.GetDegree(), 4)
    num_hs = min(atom.GetTotalNumHs(), 3)
    charge = max(min(atom.GetFormalCharge(), 3), -3) / 3.0
    feats: list[float] = []
    feats += _onehot(symbol, ATOM_SYMBOLS)          # 9
    feats += _onehot(degree, [1, 2, 3, 4])          # 4
    feats += [1.0 if atom.GetIsAromatic() else 0.0]  # 1
    feats += [1.0 if atom.IsInRing() else 0.0]       # 1
    feats += [float(charge)]                          # 1
    feats += _onehot(num_hs, [0, 1, 2, 3])           # 4
    return feats


def bond_features(bond: Chem.Bond) -> list[float]:
    """6-dim bond feature vector."""
    feats = _onehot(bond.GetBondType(), BOND_TYPES)          # 4
    feats += [1.0 if bond.GetIsConjugated() else 0.0]         # 1
    feats += [1.0 if bond.IsInRing() else 0.0]                # 1
    return feats


def mol_to_graph(smiles: str) -> dict:
    """RDKit mol → {node_features, edge_index, edge_features} (pure python)."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: {smiles!r}")
    node_features = [atom_features(a) for a in mol.GetAtoms()]
    edge_index: list[list[int]] = []
    edge_features: list[list[float]] = []
    for bond in mol.GetBonds():
        i, j = bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()
        bf = bond_features(bond)
        edge_index += [[i, j], [j, i]]
        edge_features += [bf, bf]
    if not edge_index:  # single-atom molecule
        edge_index = [[0, 0]]
        edge_features = [[0.0] * EDGE_DIM]
    return {
        "canonical_smiles": Chem.MolToSmiles(mol),
        "num_nodes": len(node_features),
        "num_edges": len(edge_index),
        "node_features": node_features,
        "edge_index": edge_index,
        "edge_features": edge_features,
    }


def featurize_smiles(smiles: str, y: Optional[Sequence[float]] = None):
    """Featurize into a PyG ``Data`` object (requires torch + PyG)."""
    if not TORCH_AVAILABLE:
        raise RuntimeError("torch / torch_geometric are not installed")
    g = mol_to_graph(smiles)
    x = torch.tensor(g["node_features"], dtype=torch.float)
    edge_index = torch.tensor(g["edge_index"], dtype=torch.long).t().contiguous()
    edge_attr = torch.tensor(g["edge_features"], dtype=torch.float)
    kwargs = {}
    if y is not None:
        kwargs["y"] = torch.tensor([list(y)], dtype=torch.float)  # [1, n_tasks] → batches to [B, n_tasks]
    return Data(x=x, edge_index=edge_index, edge_attr=edge_attr, **kwargs)


def load_csv_rows(path) -> list[dict]:
    """Load the generated ESOL-style dataset CSV."""
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


if TORCH_AVAILABLE:
    from torch.utils.data import Dataset

    class MolPropertyDataset(Dataset):
        """Dataset of (molecular graph → [logP, TPSA, logS]) tuples."""

        TARGET_COLUMNS = ["logp", "tpsa", "logs"]

        def __init__(self, rows: list[dict]):
            self.rows = [r for r in rows if _valid_row(r)]

        def __len__(self) -> int:
            return len(self.rows)

        def __getitem__(self, idx: int):
            row = self.rows[idx]
            y = [float(row[c]) for c in self.TARGET_COLUMNS]
            return featurize_smiles(row["smiles"], y=y)

else:  # torch unavailable — dataset API is not usable, keep importable
    MolPropertyDataset = None  # type: ignore[assignment,misc]


def _valid_row(row: dict) -> bool:
    from rdkit import RDLogger
    RDLogger.DisableLog("rdApp.error")
    return Chem.MolFromSmiles(row.get("smiles", "")) is not None
