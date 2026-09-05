"""Reaction Prediction Agent — retrosynthetic planning over the reaction KG.

Walks the reaction knowledge graph backwards from a target molecule,
disconnections ranked by template confidence, until commercially-available
building blocks are reached; then reports the forward route with reagents,
conditions and an estimated overall yield. The LLM (if configured) adds a
feasibility narrative.
"""
from __future__ import annotations

import logging
import time

from schemas import (
    AgentStep, PathwayRequest, PathwayResponse, PathwayStepOut,
)
from utils import reaction_graph
from utils.llm_wrapper import llm

log = logging.getLogger("alchemi.reactions")


def run_pathway(req: PathwayRequest) -> PathwayResponse:
    steps: list[AgentStep] = []
    t0 = time.perf_counter()

    def add(level: str, message: str, detail: str = "") -> None:
        steps.append(AgentStep(step=len(steps) + 1, level=level, message=message,
                               detail=detail, duration_ms=int((time.perf_counter() - t0) * 1000)))

    from utils import chemistry
    ok, target, err = chemistry.canonicalize(req.target_smiles)
    if not ok:
        add("observation", f"Invalid target SMILES rejected: {err}")
        return PathwayResponse(target_smiles=req.target_smiles, valid=False,
                               error=err, agent_steps=steps)

    stats = reaction_graph.kg_stats()
    add("thought", f"Analyzing target “{target}” against the reaction knowledge graph",
        f"{stats['templates']} reaction templates · {stats['building_blocks']} building blocks · "
        f"{stats['nodes']} nodes / {stats['edges']} edges")

    try:
        plan = reaction_graph.plan_synthesis(target, max_steps=req.max_steps)
    except Exception as exc:  # noqa: BLE001
        log.exception("Planning failed")
        add("observation", f"Planner error: {exc}")
        return PathwayResponse(target_smiles=target, valid=True, error=str(exc),
                               agent_steps=steps)

    if plan is None:
        add("answer", "No complete route found within the template library",
            "Expand the knowledge graph or supply a simpler target.")
        return PathwayResponse(
            target_smiles=target, valid=True, is_complete=False,
            agent_steps=steps,
            narrative=(
                "No complete retrosynthetic route was found with the current knowledge graph. "
                "Supported transformations: "
                + ", ".join(t.name for t in reaction_graph.REACTION_TEMPLATES)
                + ". Consider adding a template for the missing disconnection."
            ),
        )

    out_steps = [PathwayStepOut(
        step=s["step"], reaction_name=s["reaction_name"], reactants=s["reactants"],
        product=s["product"], reagents=s["reagents"], conditions=s["conditions"],
        confidence=s["confidence"], typical_yield=s["typical_yield"],
    ) for s in plan["steps"]]

    add("tool", f"Decomposed target into {len(out_steps)} reaction step(s)",
        " → ".join([out_steps[0].reactants[0], out_steps[-1].product]) if out_steps else "")
    add("observation",
        f"Route to commercial starting material: "
        f"{'YES' if plan['complete'] else 'PARTIAL'} "
        f"(confidence {plan['confidence']:.0%}, est. overall yield {plan['overall_yield'] * 100:.0f}%)",
        ", ".join(plan["starting_materials"]))

    narrative = llm.summarize_pathway(target, plan) or _fallback_narrative(plan)
    add("answer", f"Proposed {len(out_steps)}-step route ({'+'.join(s.reaction_name for s in out_steps[:3])}…)")

    return PathwayResponse(
        target_smiles=target, valid=True,
        steps=out_steps,
        starting_materials=plan["starting_materials"],
        overall_confidence=plan["confidence"],
        estimated_overall_yield=round(plan["overall_yield"] * 100, 1),
        is_complete=plan["complete"],
        agent_steps=steps,
        narrative=narrative,
    )


def _fallback_narrative(plan: dict) -> str:
    names = [s["reaction_name"] for s in plan["steps"]]
    blocks = [reaction_graph._BLOCK_SMILES.get(s, s) for s in plan["starting_materials"]]
    return (
        f"The proposed route uses {len(plan['steps'])} step(s) — {' → '.join(names)} — "
        f"starting from commercially available {'/'.join(blocks[:4])} at an estimated overall yield of "
        f"{plan['overall_yield'] * 100:.0f}% and route confidence {plan['confidence']:.0%}. "
        "Key risks: over-alkylation in the N-alkylation step and regioisomer formation; "
        "purify intermediates by crystallization or silica chromatography."
    )
