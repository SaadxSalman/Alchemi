"""Chemical Intelligence — LLM orchestration with graceful offline fallback.

Uses LangChain + OpenAI when ``OPENAI_API_KEY`` is configured. Without a
key (or on any failure) every method returns ``None`` and the agents fall
back to Alchemi's built-in rule-based chemical reasoning, so the platform
remains fully functional offline.
"""
from __future__ import annotations

import logging
import re

from config import settings

log = logging.getLogger("alchemi.llm")

try:
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_openai import ChatOpenAI
    LANGCHAIN_AVAILABLE = True
except Exception as exc:  # noqa: BLE001
    LANGCHAIN_AVAILABLE = False
    log.info("LangChain not available (%s) — LLM layer disabled.", exc)

SYSTEM_PROMPT = (
    "You are Alchemi's chemistry reasoning engine: a medicinal chemist with deep "
    "knowledge of reaction mechanisms, SAR and ADME principles. Be precise with "
    "SMILES notation and realistic with conditions and yields."
)


class ChemicalLLM:
    """Thin, fault-tolerant wrapper around the chemistry-tuned LLM."""

    def __init__(self) -> None:
        self.available = False
        self._llm = None
        if not settings.llm_enabled:
            return
        if not LANGCHAIN_AVAILABLE:
            log.info("langchain-openai not installed — running offline fallback.")
            return
        try:
            kwargs: dict = {
                "model": settings.openai_model,
                "temperature": settings.llm_temperature,
                "timeout": 60,
                "max_retries": 1,
            }
            if settings.openai_base_url:
                kwargs["base_url"] = settings.openai_base_url
            self._llm = ChatOpenAI(api_key=settings.openai_api_key, **kwargs)
            self.available = True
            log.info("Chemical LLM online: model=%s", settings.openai_model)
        except Exception as exc:  # noqa: BLE001
            log.warning("ChatOpenAI init failed (%s) — offline fallback.", exc)

    # ── low-level ────────────────────────────────────────────────────────
    def _chat(self, system: str, user: str) -> str | None:
        if not self.available:
            return None
        try:
            prompt = ChatPromptTemplate.from_messages(
                [("system", system), ("human", "{input}")]
            )
            response = (prompt | self._llm).invoke({"input": user})
            return response.content.strip() if response and response.content else None
        except Exception as exc:  # noqa: BLE001
            log.warning("LLM call failed: %s", exc)
            return None

    # ── Molecule Design Agent ────────────────────────────────────────────
    def propose_candidates(self, objective: str, targets: dict, n: int) -> list[dict]:
        """Ask the LLM for novel SMILES. Returns [{smiles, rationale}] (validated)."""
        from utils import chemistry

        user = (
            f"Design {n} novel, synthetically plausible drug-like molecules.\n"
            f"Objective: {objective}\n"
            f"Target property envelope: {targets}\n"
            "Constraints: valid valence, drug-like, avoid PAINS motifs.\n"
            'Reply with ONLY a JSON array: [{"smiles": "<SMILES>", "rationale": "<one sentence>"}]'
        )
        raw = self._chat(SYSTEM_PROMPT, user)
        if not raw:
            return []
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if not match:
            return []
        try:
            import json as _json
            data = _json.loads(match.group(0))
        except Exception:  # noqa: BLE001
            return []
        out = []
        for item in data:
            if not isinstance(item, dict) or not item.get("smiles"):
                continue
            ok, cano, _ = chemistry.canonicalize(str(item.get("smiles", "")))
            if ok:
                out.append({"smiles": cano, "rationale": str(item.get("rationale", ""))[:400]})
            if len(out) >= n:
                break
        return out

    def summarize_design(self, objective: str, top: list[dict]) -> str | None:
        lines = "\n".join(
            f"- {c['smiles']} (score {c['score']}, MW {c['descriptors']['molecular_weight']}, "
            f"logP {c['descriptors']['logp']}, TPSA {c['descriptors']['tpsa']})"
            for c in top[:5]
        )
        return self._chat(
            SYSTEM_PROMPT,
            f"Research objective: {objective}\nTop candidates:\n{lines}\n"
            "Write a 3–5 sentence synthesis-strategy summary for the team.",
        )

    # ── Reaction Prediction Agent ────────────────────────────────────────
    def summarize_pathway(self, target: str, plan: dict) -> str | None:
        steps = "\n".join(
            f"{s['step']}. {s['reaction_name']}: {' + '.join(s['reactants'])} → {s['product']} "
            f"({', '.join(s['reagents'])}, {s['conditions']})"
            for s in plan["steps"]
        )
        return self._chat(
            SYSTEM_PROMPT,
            f"Retrosynthesis for {target}:\n{steps}\n"
            "Assess route feasibility, competing side reactions and purification strategy in 3–5 sentences.",
        )

    # ── Simulation Agent ─────────────────────────────────────────────────
    def feasibility_narrative(self, smiles: str, desc: dict, rules: list[dict]) -> str | None:
        failed = [r["name"] for r in rules if not r["passed"]]
        return self._chat(
            SYSTEM_PROMPT,
            f"Molecule: {smiles}\nDescriptors: {desc}\nFailed rules: {failed}\n"
            "Give a 3–5 sentence drug-likeness / developability assessment.",
        )


llm = ChemicalLLM()