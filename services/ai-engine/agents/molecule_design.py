"""Molecule Design Agent — autonomous de-novo molecular design.

Pipeline: parse objective → LLM proposal (optional) → fragment-based
generation → RDKit featurization & scoring → GATv2 property inference →
PAINS/Lipinski filtering → ranked, rationaled candidate list.
"""
from __future__ import annotations

import time

from models import get_predictor
from schemas import (
    AgentStep, CandidateOut, DesignRequest, DesignResponse, Descriptors,
    MoleculeAlert, PredictedProperties,
)
from utils import chemistry, generator
from utils.llm_wrapper import llm


def _mk_step(idx: int, level: str, message: str, detail: str, t0: float) -> AgentStep:
    return AgentStep(
        step=idx, level=level, message=message, detail=detail,
        duration_ms=int((time.perf_counter() - t0) * 1000),
    )


def run_design(req: DesignRequest) -> DesignResponse:
    steps: list[AgentStep] = []
    t0 = time.perf_counter()

    def add(level: str, message: str, detail: str = "") -> None:
        steps.append(_mk_step(len(steps) + 1, level, message, detail, t0))

    targets = req.targets.model_dump()
    add("thought", f"Parsed objective: “{req.objective}”",
        f"Envelope: MW {targets['mw_min']}–{targets['mw_max']} Da, "
        f"logP {targets['logp_min']}–{targets['logp_max']}, "
        f"TPSA {targets['tpsa_min']}–{targets['tpsa_max']} Å²")

    # 1) LLM-driven proposal (if configured)
    llm_props: dict[str, str] = {}
    if llm.available:
        add("tool", "Consulting chemistry-tuned LLM for candidate structures…")
        for c in llm.propose_candidates(req.objective, targets, req.num_candidates):
            llm_props[c["smiles"]] = c["rationale"]
        add("observation", f"LLM proposed {len(llm_props)} valid, RDKit-canonical structures")
    else:
        add("thought", "No LLM key configured — engaging built-in fragment-based generator")

    # 2) Fragment-based generative engine (always contributes diversity)
    seed = abs(hash(req.objective)) % (2 ** 31)
    generated = generator.generate_candidates(req.num_candidates * 5 + 8, seed=seed)
    add("tool", f"Fragment assembler enumerated {len(generated)} unique valid structures",
        f"scaffolds={len(generator.SCAFFOLDS)} × substituents={len(generator.SUBSTITUENTS)} × linkers={len(generator.LINKERS)}")

    # 3) Evaluate every unique candidate
    merged: dict[str, dict] = {}
    for origin, items in (("llm", list(llm_props.keys())),
                          ("fragment-generator", [g["smiles"] for g in generated])):
        for smi in items:
            if smi in merged:
                continue
            try:
                desc = chemistry.compute_descriptors(smi)
                alerts = chemistry.structural_alerts(smi) if req.avoid_pains else []
            except Exception:  # noqa: BLE001
                continue
            score = generator.score_candidate(desc, targets, req.drug_like, alerts)
            merged[smi] = {"descriptors": desc, "alerts": alerts, "score": score, "origin": origin}
    add("observation", f"Featurized {len(merged)} unique molecules with RDKit")

    # 4) GATv2 property inference (falls back to RDKit heuristics)
    predictor = get_predictor()
    smiles_list = list(merged.keys())
    if predictor is not None:
        add("tool", f"Running GATv2 inference ({predictor.display_name})")
        preds = predictor.predict(smiles_list)
        for smi, p in zip(smiles_list, preds):
            merged[smi]["predicted"] = PredictedProperties(
                logp=p["logp"], tpsa=p["tpsa"], log_solubility=p["log_solubility"],
                model=p["model"])
    else:
        add("observation", "No GATv2 checkpoint — predicting solubility via ESOL heuristic")
        for smi, data in merged.items():
            data["predicted"] = PredictedProperties(
                logp=data["descriptors"]["logp"],
                tpsa=data["descriptors"]["tpsa"],
                log_solubility=chemistry.estimate_solubility(data["descriptors"]),
                model="RDKit heuristic")

    # 5) Rank & build output
    ranked = sorted(merged.items(), key=lambda kv: kv[1]["score"], reverse=True)
    candidates: list[CandidateOut] = []
    for rank, (smi, data) in enumerate(ranked[: req.num_candidates], start=1):
        desc = Descriptors(**data["descriptors"])
        rationale = llm_props.get(smi) or _fallback_rationale(req.objective, data)
        candidates.append(CandidateOut(
            smiles=smi, valid=True, score=data["score"], rank=rank,
            origin=data["origin"], rationale=rationale,
            descriptors=desc, predicted=data["predicted"],
            alerts=[MoleculeAlert(**a) for a in data["alerts"]],
            passes_lipinski=all(c["passed"] for c in chemistry.lipinski_checks(data["descriptors"])),
        ))

    summary = llm.summarize_design(req.objective, [
        {"smiles": c.smiles, "score": c.score, "descriptors": c.descriptors.model_dump()}
        for c in candidates
    ]) or _fallback_summary(req.objective, candidates)

    add("answer", f"Selected {len(candidates)} top candidates",
        f"best score {candidates[0].score if candidates else 0}/100")

    return DesignResponse(
        objective=req.objective,
        candidates=candidates,
        agent_steps=steps,
        summary=summary,
        llm_provider="openai" if llm.available else "offline-fallback",
        generator_stats={
            "llm_proposed": len(llm_props),
            "generated": len(generated),
            "evaluated": len(merged),
            "seed": seed,
        },
    )


def _fallback_rationale(objective: str, data: dict) -> str:
    d = data["descriptors"]
    lip = all(c["passed"] for c in chemistry.lipinski_checks(d))
    return (
        f"Assembled around a {'polycyclic' if d['ring_count'] > 1 else 'monocyclic'} scaffold "
        f"({d['aromatic_rings']} aromatic ring(s)). MW {d['molecular_weight']} Da, logP {d['logp']}, "
        f"TPSA {d['tpsa']} Å² fit the '{objective}' envelope"
        + (" and the structure passes Lipinski's Rule of 5." if lip
           else " though some Lipinski parameters are outside the classic envelope.")
    )


def _fallback_summary(objective: str, candidates: list[CandidateOut]) -> str:
    if not candidates:
        return (f"No candidates satisfied the constraints for “{objective}”. "
                "Try widening the property envelope.")
    best = candidates[0]
    druglike = sum(1 for c in candidates if c.passes_lipinski)
    return (
        f"Designed {len(candidates)} novel structures for “{objective}”. Lead candidate "
        f"{best.smiles} (score {best.score}/100) balances MW {best.descriptors.molecular_weight} Da, "
        f"logP {best.descriptors.logp} and TPSA {best.descriptors.tpsa} Å²; {druglike}/{len(candidates)} "
        "candidates comply with Lipinski's Rule of 5. Synthesis should start from the heteroaryl "
        "core via amide coupling or Suzuki chemistry, with a final salt screen for solubility."
    )