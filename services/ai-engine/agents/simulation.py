"""Simulation Agent — validates feasibility of a proposed molecule.

Combines: full RDKit descriptor suite, Lipinski RO5 + Veber rules,
PAINS/BRENK alert screening, optional MMFF94 conformer energetics, and
GATv2 property inference (logP / TPSA / logS).
"""
from __future__ import annotations

import logging
import time

from rdkit import Chem
from rdkit.Chem import AllChem

from models import get_predictor
from schemas import (
    AgentStep, ConformerInfo, Descriptors, MoleculeAlert, PredictedProperties,
    RuleCheck, SimulateRequest, SimulationResponse,
)
from utils import chemistry
from utils.llm_wrapper import llm

log = logging.getLogger("alchemi.simulation")


def _drug_likeness(desc: dict, alerts: list[dict]) -> float:
    score = 100.0 * desc["qed"]
    lip = chemistry.lipinski_checks(desc) + chemistry.veber_checks(desc)
    failed = sum(1 for r in lip if not r["passed"])
    score -= 12.0 * failed
    score -= 6.0 * min(len(alerts), 3)
    return round(max(0.0, min(100.0, score)), 1)


def _conformer_info(smiles: str) -> ConformerInfo:
    """Best-effort 3D conformer + MMFF energy (never fatal)."""
    try:
        mol = Chem.AddHs(Chem.MolFromSmiles(smiles))
        if AllChem.EmbedMolecule(mol, randomSeed=0xC1A5E1) != 0:
            return ConformerInfo(generated=False)
        if AllChem.MMFFHasAllMoleculeParams(mol):
            props = AllChem.MMFFGetMoleculeProperties(mol)
            energy = AllChem.MMFFOptimizeMolecule(mol, mmffVariant="MMFF94", maxIters=500)
            mmff_energy = AllChem.MMFFGetMoleculeForceField(mol, props).CalcEnergy()
            return ConformerInfo(generated=True,
                                 energy_kcal_mol=round(float(mmff_energy), 2),
                                 method="MMFF94 (optimized)")
        return ConformerInfo(generated=True, method="embedded (no MMFF params)")
    except Exception as exc:  # noqa: BLE001
        log.debug("Conformer generation failed: %s", exc)
        return ConformerInfo(generated=False, method="MMFF94 (unavailable)")


def run_simulation(req: SimulateRequest) -> SimulationResponse:
    steps: list[AgentStep] = []
    t0 = time.perf_counter()

    def add(level: str, message: str, detail: str = "") -> None:
        steps.append(AgentStep(step=len(steps) + 1, level=level, message=message,
                               detail=detail, duration_ms=int((time.perf_counter() - t0) * 1000)))

    ok, canon, err = chemistry.canonicalize(req.smiles)
    if not ok:
        add("observation", f"Invalid SMILES rejected: {err}")
        return SimulationResponse(smiles=req.smiles, canonical_smiles="",
                                  valid=False, error=err, agent_steps=steps)

    add("thought", f"Target validated: {canon}")

    desc = chemistry.compute_descriptors(canon)
    add("tool", "Computed full RDKit descriptor suite",
        f"MW {desc['molecular_weight']} Da, logP {desc['logp']}, TPSA {desc['tpsa']} Å², QED {desc['qed']}")

    rules = chemistry.lipinski_checks(desc) + chemistry.veber_checks(desc)
    add("tool", "Screened Lipinski Rule of 5 + Veber rules",
        f"{sum(1 for r in rules if r['passed'])}/{len(rules)} checks passed")

    alerts = chemistry.structural_alerts(canon)
    add("tool", "Scanned PAINS / BRENK structural alert catalogs",
        f"{len(alerts)} alert(s)" if alerts else "no alerts triggered")

    predictor = get_predictor()
    if predictor is not None:
        add("tool", f"GATv2 inference ({predictor.display_name})")
        p = predictor.predict([canon])[0]
        predicted = PredictedProperties(logp=p["logp"], tpsa=p["tpsa"],
                                        log_solubility=p["log_solubility"], model=p["model"])
    else:
        add("observation", "No GATv2 checkpoint — using ESOL heuristic for solubility")
        p = PredictedProperties(logp=desc["logp"], tpsa=desc["tpsa"],
                                log_solubility=chemistry.estimate_solubility(desc),
                                model="RDKit heuristic")

    conformer = _conformer_info(canon)
    if conformer.generated:
        add("tool", "Embedded 3D conformer and minimized (MMFF94)",
            f"E = {conformer.energy_kcal_mol} kcal/mol" if conformer.energy_kcal_mol is not None else "")

    narrative = llm.feasibility_narrative(canon, desc, rules) or _fallback_narrative(canon, desc, rules)
    add("answer", "Simulation complete",
        f"drug-likeness score {round(100.0 * desc['qed'])}/100")

    return SimulationResponse(
        smiles=req.smiles, canonical_smiles=canon, valid=True,
        descriptors=Descriptors(**desc), predicted=p,
        rule_checks=[RuleCheck(**r) for r in rules],
        alerts=[MoleculeAlert(**a) for a in alerts],
        conformer=conformer,
        drug_likeness_score=_drug_likeness(desc, alerts),
        agent_steps=steps, narrative=narrative,
    )


def _fallback_narrative(smiles: str, desc: dict, rules: list[dict]) -> str:
    failed = [r["name"] for r in rules if not r["passed"]]
    sol = chemistry.estimate_solubility(desc)
    parts = [
        f"{smiles} has MW {desc['molecular_weight']} Da, logP {desc['logp']} and TPSA "
        f"{desc['tpsa']} Å² with an estimated aqueous solubility of {sol} log(S)."
    ]
    if failed:
        parts.append(f"Developability watch-outs: {'; '.join(failed)}.")
    else:
        parts.append("The molecule satisfies Lipinski's Rule of 5 and Veber oral-bioavailability "
                     "criteria, suggesting good passive permeability.")
    if desc["fraction_csp3"] < 0.2:
        parts.append("Low sp³ fraction indicates a flat, aromatic scaffold — 3D-shape diversity "
                     "screening is advisable.")
    return " ".join(parts)
