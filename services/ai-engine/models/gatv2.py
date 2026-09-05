"""GATv2 (Graph Attention Network v2) — the core molecular property model.

A 3-layer GATv2Conv encoder with edge features (bond types), followed by
mean+max graph pooling and an MLP head that regresses three targets:
    [logP, TPSA, logS(ESOL-style solubility)]

torch / torch_geometric are imported defensively so the whole AI engine
still boots (with heuristic property prediction) if they are missing.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

log = logging.getLogger("alchemi.gatv2")

try:
    import torch
    from torch import Tensor, nn
    from torch_geometric.data import Batch
    from torch_geometric.nn import GATv2Conv, global_max_pool, global_mean_pool
    TORCH_AVAILABLE = True
except Exception as exc:  # noqa: BLE001
    TORCH_AVAILABLE = False
    log.warning("PyTorch / torch_geometric unavailable (%s) — GATv2 disabled.", exc)

TASK_NAMES = ["logp", "tpsa", "logs"]


if TORCH_AVAILABLE:

    class GATv2PropertyPredictor(nn.Module):
        """Graph Attention Network for multi-task molecular property regression."""

        def __init__(
            self,
            node_dim: int = 20,
            edge_dim: int = 6,
            hidden: int = 64,
            heads: int = 4,
            num_layers: int = 3,
            n_tasks: int = 3,
            dropout: float = 0.1,
        ) -> None:
            super().__init__()
            self.input_proj = nn.Linear(node_dim, hidden)
            self.convs = nn.ModuleList()
            self.norms = nn.ModuleList()
            for i in range(num_layers):
                in_dim = hidden if i == 0 else hidden * heads
                self.convs.append(
                    GATv2Conv(in_dim, hidden, heads=heads, edge_dim=edge_dim,
                              concat=True, residual=True)
                )
                self.norms.append(nn.LayerNorm(hidden * heads))
            self.dropout = nn.Dropout(dropout)
            self.head = nn.Sequential(
                nn.Linear(hidden * heads * 2, 256),
                nn.GELU(),
                nn.Dropout(dropout),
                nn.Linear(256, n_tasks),
            )

        def forward(self, x: Tensor, edge_index: Tensor, edge_attr: Tensor, batch: Tensor) -> Tensor:
            x = self.input_proj(x)
            for conv, norm in zip(self.convs, self.norms):
                h = conv(x, edge_index, edge_attr)
                x = norm(h)
                x = self.dropout(nn.functional.gelu(x)) + x  # residual
            pooled = torch.cat(
                [global_mean_pool(x, batch), global_max_pool(x, batch)], dim=1
            )
            return self.head(pooled)


class PropertyModel:
    """Inference wrapper: loads a trained GATv2 checkpoint + normalization meta."""

    def __init__(self, checkpoint: Path, meta: dict, model: "GATv2PropertyPredictor"):
        self.checkpoint = checkpoint
        self.meta = meta
        self.model = model
        self.model.eval()
        self._mean = meta.get("target_mean", [0.0, 0.0, 0.0])
        self._std = meta.get("target_std", [1.0, 1.0, 1.0])

    @classmethod
    def load(cls, checkpoint_path: str | Path) -> Optional["PropertyModel"]:
        if not TORCH_AVAILABLE:
            return None
        path = Path(checkpoint_path)
        meta_path = path.with_suffix("").parent / (path.stem + "_meta.json")
        if not path.is_file() or not meta_path.is_file():
            log.info("GATv2 checkpoint not found at %s — using heuristics.", path)
            return None
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            payload = torch.load(path, map_location="cpu", weights_only=True)
            model = GATv2PropertyPredictor(
                node_dim=meta.get("node_dim", 20),
                edge_dim=meta.get("edge_dim", 6),
                hidden=meta.get("hidden", 64),
                heads=meta.get("heads", 4),
                num_layers=meta.get("num_layers", 3),
                n_tasks=len(meta.get("task_names", TASK_NAMES)),
            )
            model.load_state_dict(payload["state_dict"])
            log.info("Loaded GATv2 checkpoint %s (val MAE: %s)", path.name,
                     meta.get("val_mae"))
            return cls(path, meta, model)
        except Exception as exc:  # noqa: BLE001
            log.warning("Failed to load GATv2 checkpoint: %s", exc)
            return None

    @property
    def display_name(self) -> str:
        return f"GATv2 ({self.checkpoint.name})"

    def predict(self, smiles_list: list[str]) -> list[dict]:
        """Predict [logP, TPSA, logS] for each SMILES (invalid → zeros)."""
        from utils.data_loader import featurize_smiles

        results: list[dict] = []
        pending: list[tuple[int, object]] = []
        for i, smi in enumerate(smiles_list):
            try:
                pending.append((i, featurize_smiles(smi)))
            except Exception:  # noqa: BLE001
                results.append(self._empty(smi))
        if pending:
            with torch.no_grad():
                batch = Batch.from_data_list([d for _, d in pending])
                preds = self.model(batch.x, batch.edge_index, batch.edge_attr, batch.batch)
                preds = preds.cpu()
            for row, (i, _) in zip(preds, pending):
                vals = {
                    name: float(row[j]) * self._std[j] + self._mean[j]
                    for j, name in enumerate(TASK_NAMES)
                }
                results.append({
                    "index": i,
                    "model": self.display_name,
                    "logp": round(vals["logp"], 3),
                    "tpsa": round(vals["tpsa"], 2),
                    "log_solubility": round(vals["logs"], 3),
                })
        results.sort(key=lambda r: r.get("index", 0))
        return [{k: v for k, v in r.items() if k != "index"} for r in results]

    def _empty(self, smiles: str) -> dict:
        return {"model": self.display_name, "logp": 0.0, "tpsa": 0.0,
                "log_solubility": 0.0, "invalid": smiles}
