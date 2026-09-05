"""Train the GATv2 property-prediction model on the generated dataset.

Multitask regression: [logP, TPSA, logS] from molecular graphs.
Saves  models/checkpoints/gatv2_multitask.pt  (+ *_meta.json with
normalization statistics and validation metrics).

Run:  python train.py [--epochs 40]
"""
from __future__ import annotations

import argparse
import json
import random
import statistics
import sys
from pathlib import Path

import torch

SERVICE_ROOT = Path(__file__).resolve().parent

from models.gatv2 import GATv2PropertyPredictor  # noqa: E402
from utils.data_loader import MolPropertyDataset, load_csv_rows  # noqa: E402

from torch_geometric.loader import DataLoader  # noqa: E402

DATASET = SERVICE_ROOT / "data" / "esol_estimated.csv"
CHECKPOINT_DIR = SERVICE_ROOT / "models" / "checkpoints"
CHECKPOINT = CHECKPOINT_DIR / "gatv2_multitask.pt"
META = CHECKPOINT_DIR / "gatv2_multitask_meta.json"
TARGETS = ["logp", "tpsa", "logs"]


def split_rows(rows: list[dict], seed: int = 13):
    rows = sorted(rows, key=lambda r: r["smiles"])
    random.Random(seed).shuffle(rows)
    n = len(rows)
    n_train, n_val = int(n * 0.8), int(n * 0.1)
    return rows[:n_train], rows[n_train:n_train + n_val], rows[n_train + n_val:]


def dataset_stats(rows: list[dict]) -> tuple[list[float], list[float]]:
    means, stds = [], []
    for col in TARGETS:
        vals = [float(r[col]) for r in rows]
        means.append(statistics.fmean(vals))
        stds.append(statistics.pstdev(vals) or 1.0)
    return means, stds


def normalize_rows(rows, means, stds):
    for r in rows:
        for i, col in enumerate(TARGETS):
            r[col] = (float(r[col]) - means[i]) / stds[i]
    return rows


def run_epoch(model, loader, optimizer, device) -> float:
    model.train()
    total, count = 0.0, 0
    for batch in loader:
        batch = batch.to(device)
        optimizer.zero_grad()
        out = model(batch.x, batch.edge_index, batch.edge_attr, batch.batch)
        loss = torch.nn.functional.mse_loss(out, batch.y)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        total += float(loss.item()) * batch.num_graphs
        count += batch.num_graphs
    return total / max(count, 1)


@torch.no_grad()
def evaluate(model, loader, device) -> dict:
    model.eval()
    total_loss, total_n = 0.0, 0
    mae_acc = [[] for _ in TARGETS]
    for batch in loader:
        batch = batch.to(device)
        out = model(batch.x, batch.edge_index, batch.edge_attr, batch.batch)
        total_loss += float(torch.nn.functional.mse_loss(out, batch.y, reduction="sum"))
        total_n += batch.num_graphs
        for t in range(len(TARGETS)):
            mae_acc[t].append(float((out[:, t] - batch.y[:, t]).abs().mean()))
    return {
        "val_loss": total_loss / max(total_n, 1),
        "val_mae": {TARGETS[t]: round(sum(mae_acc[t]) / max(len(mae_acc[t]), 1), 4)
                    for t in range(len(TARGETS))},
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--hidden", type=int, default=64)
    parser.add_argument("--batch-size", type=int, default=32)
    args = parser.parse_args()

    rows = load_csv_rows(DATASET)
    print(f"Dataset: {len(rows)} molecules → {DATASET.name}")

    train_rows, val_rows, test_rows = split_rows(rows)
    means, stds = dataset_stats(train_rows)
    normalize_rows(train_rows, means, stds)
    normalize_rows(val_rows, means, stds)
    normalize_rows(test_rows, means, stds)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device} · train/val/test = {len(train_rows)}/{len(val_rows)}/{len(test_rows)}")

    train_loader = DataLoader(MolPropertyDataset(train_rows), batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(MolPropertyDataset(val_rows), batch_size=args.batch_size)
    test_loader = DataLoader(MolPropertyDataset(test_rows), batch_size=args.batch_size)

    model = GATv2PropertyPredictor(hidden=args.hidden).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    best_val, best_state = float("inf"), None
    for epoch in range(1, args.epochs + 1):
        loss = run_epoch(model, train_loader, optimizer, device)
        val = evaluate(model, val_loader, device)
        scheduler.step()
        marker = ""
        if val["val_loss"] < best_val:
            best_val, best_state = val["val_loss"], {
                k: v.detach().cpu().clone() for k, v in model.state_dict().items()
            }
            marker = " ★"
        if epoch % 5 == 0 or epoch == 1:
            print(f"epoch {epoch:3d} · train MSE {loss:.4f} · val MSE {val['val_loss']:.4f}{marker}")

    test = evaluate(model, test_loader, device)
    print(f"Test metrics: {test}")

    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": best_state or model.state_dict()}, CHECKPOINT)
    META.write_text(json.dumps({
        "task_names": TARGETS,
        "node_dim": 20, "edge_dim": 6,
        "hidden": args.hidden, "heads": 4, "num_layers": 3,
        "target_mean": means, "target_std": stds,
        "val_mae": test["val_mae"], "val_loss": test["val_loss"],
        "epochs": args.epochs, "dataset": DATASET.name,
    }, indent=2), encoding="utf-8")
    print(f"Saved checkpoint → {CHECKPOINT}")
    print(f"Saved meta       → {META}")


if __name__ == "__main__":
    main()