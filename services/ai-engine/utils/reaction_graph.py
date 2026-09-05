"""The Reaction Knowledge Graph — chemical intelligence backbone for the
Reaction Prediction Agent.

A curated library of named reaction templates (RDKit SMARTS transforms)
with reagents, conditions, confidence and typical yield, plus a catalogue
of commercially-available building blocks. A networkx graph links
functional groups through transformations; a retro-planner walks the graph
backwards from a target molecule to purchasable starting materials.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

from rdkit import Chem
from rdkit.Chem import AllChem

log = logging.getLogger("alchemi.reactions")


@dataclass
class ReactionTemplate:
    name: str
    forward_smarts: str   # reactants >> product
    retro_smarts: str     # product >> precursors
    reagents: list[str] = field(default_factory=list)
    conditions: str = ""
    confidence: float = 0.8
    typical_yield: str = "50–85%"
    notes: str = ""

    def compiled(self):
        return AllChem.ReactionFromSmarts(self.forward_smarts)

    def compiled_retro(self):
        return AllChem.ReactionFromSmarts(self.retro_smarts)


REACTION_TEMPLATES: list[ReactionTemplate] = [
    ReactionTemplate(
        name="Amide coupling",
        forward_smarts="[C:1](=[O:2])[OX2H1].[NX3H2,NX3H1:3]>>[C:1](=[O:2])[N:3]",
        retro_smarts="[C:1](=[O:2])[NX3H0,NX3H1:3]>>[C:1](=[O:2])[OX2H1].[NX3H2,NX3H1:3]",
        reagents=["HATU (or EDCI/HOBt)", "DIPEA"],
        conditions="DMF, 0 °C → rt, 2–16 h",
        confidence=0.88, typical_yield="60–90%",
        notes="Peptide-bond style coupling; primary/secondary amines.",
    ),
    ReactionTemplate(
        name="Suzuki–Miyaura coupling",
        forward_smarts="[c:1][Cl,Br,I].[c:2][B](O)O>>[c:1][c:2]",
        retro_smarts="[c:1][c:2]>>[c:1][Cl,Br,I].[c:2][B](O)O",
        reagents=["Pd(PPh3)4 (2–5 mol%)", "K2CO3 aq."],
        conditions="1,4-dioxane/H2O, N2, 80 °C, 4–18 h",
        confidence=0.85, typical_yield="55–90%",
        notes="Biaryl C–C bond formation; tolerates wide FG range.",
    ),
    ReactionTemplate(
        name="Williamson ether synthesis",
        forward_smarts="[OX2H1:1].[CX4H2,CX4H3:2][Cl,Br,I]>>[CX4:2][OX2:1]",
        retro_smarts="[CX4:2][OX2H0:1]>>[CX4H2,CX4H3:2][Cl,Br,I].[OX2H1:1]",
        reagents=["NaH (or K2CO3)"],
        conditions="DMF or acetone, rt–60 °C",
        confidence=0.82, typical_yield="55–90%",
        notes="Alkoxide + primary alkyl halide → ether.",
    ),
    ReactionTemplate(
        name="Reductive amination",
        forward_smarts="[CX3H0,CX3H1:1]=[OX1:2].[NX3H2,NX3H1:3]>>[CX4:1][NX3:3]",
        retro_smarts="[CX4H1,CX4H2:1][NX3H0,NX3H1:3]>>[CX3H0,CX3H1:1]=[OX1:2].[NX3H2,NX3H1:3]",
        reagents=["NaBH(OAc)3 (or NaBH3CN)", "AcOH (cat.)"],
        conditions="DCE or MeOH, rt, 2–18 h",
        confidence=0.83, typical_yield="50–85%",
        notes="Carbonyl + amine → alkylated amine; mild & chemoselective.",
    ),
    ReactionTemplate(
        name="Sulfonamide formation",
        forward_smarts="[S:1](=[O:2])(=[O:3])(Cl).[NX3H2,NX3H1:4]>>[S:1](=[O:2])(=[O:3])[N:4]",
        retro_smarts="[S:1](=[O:2])(=[O:3])[NX3H0,NX3H1:4]>>[S:1](=[O:2])(=[O:3])Cl.[NX3H2,NX3H1:4]",
        reagents=["Et3N or pyridine"],
        conditions="CH2Cl2, 0 °C → rt",
        confidence=0.87, typical_yield="60–92%",
        notes="Sulfonyl chloride + amine; basis of many sulfonamide drugs.",
    ),
    ReactionTemplate(
        name="Urea formation (isocyanate route)",
        forward_smarts="[NX3:1]=[CX3:2]=[OX1:3].[NX3H2:4]>>[NX3:1][CX3:2](=[OX1:3])[NX3:4]",
        retro_smarts="[NX3:1][CX3:2](=[OX1:3])[NX3H0,NX3H1:4]>>[N:1]=[C:2]=[O:3].[NX3H2:4]",
        reagents=["isocyanate (1.05 eq)"],
        conditions="THF or CH2Cl2, rt",
        confidence=0.80, typical_yield="55–88%",
        notes="Amine + isocyanate → unsymmetrical urea.",
    ),
    ReactionTemplate(
        name="SNAr amination",
        forward_smarts="[c:1][F,Cl:2].[NX3H2:3]>>[c:1][N:3]",
        retro_smarts="[c:1][NX3H0,NX3H1:3]>>[c:1][F,Cl:2].[NX3H2:3]",
        reagents=["amine (excess)", "K2CO3"],
        conditions="DMSO or NMP, 60–100 °C",
        confidence=0.62, typical_yield="40–80%",
        notes="Requires electron-poor aryl halide (EWG ortho/para).",
    ),
    ReactionTemplate(
        name="Carbonyl reduction (FGI)",
        forward_smarts="[C:1]=[O:2]>>[C:1][O:2]",
        retro_smarts="[CX4H1,CX4H2:1][OX2H1:2]>>[CX3H0,CX3H1:1]=[OX1:2]",
        reagents=["NaBH4"],
        conditions="MeOH, 0 °C → rt",
        confidence=0.90, typical_yield="70–95%",
        notes="Aldehyde/ketone → primary/secondary alcohol.",
    ),
    ReactionTemplate(
        name="Alcohol → alkyl halide (FGI)",
        forward_smarts="[CX4:1][OX2H1:2]>>[CX4:1][Br:2]",
        retro_smarts="[CX4H2,CX4H3:1][Br,Cl,I:2]>>[CX4:1][OX2H1:2]",
        reagents=["PBr3 (or CBr4/PPh3)"],
        conditions="CH2Cl2 or Et2O, 0 °C → rt",
        confidence=0.85, typical_yield="65–90%",
        notes="Feedstock step for Williamson / N-alkylation chemistry.",
    ),
    ReactionTemplate(
        name="N-alkylation",
        forward_smarts="[NX3H1,NX3H2:1].[CX4H2:2][Cl,Br,I]>>[N:1][CX4H2:2]",
        retro_smarts="[NX3H0,NX3H1:1][CX4H2:2]>>[NX3H1,NX3H2:1].[CX4H2:2][Cl,Br,I]",
        reagents=["K2CO3", "KI (cat.)"],
        conditions="DMF, 50 °C",
        confidence=0.75, typical_yield="50–85%",
        notes="Amine + alkyl halide → N-alkylated amine.",
    ),
]

# Commercially-available starting materials (leaf nodes of the KG)
BUILDING_BLOCKS: dict[str, str] = {
    "acetic acid": "CC(=O)O",
    "acetyl chloride": "CC(=O)Cl",
    "benzaldehyde": "O=Cc1ccccc1",
    "4-fluorobenzaldehyde": "O=Cc1ccc(F)cc1",
    "benzoic acid": "OC(=O)c1ccccc1",
    "benzoyl chloride": "O=C(Cl)c1ccccc1",
    "aniline": "Nc1ccccc1",
    "4-fluoronitrobenzene": "O=[N+]([O-])c1ccc(F)cc1",
    "phenol": "Oc1ccccc1",
    "bromobenzene": "Brc1ccccc1",
    "chlorobenzene": "Clc1ccccc1",
    "toluene": "Cc1ccccc1",
    "anisole": "COc1ccccc1",
    "benzyl alcohol": "OCc1ccccc1",
    "phenylboronic acid": "OB(O)c1ccccc1",
    "methanesulfonyl chloride": "CS(=O)(=O)Cl",
    "methylamine": "CN",
    "ethylamine": "CCN",
    "ammonia": "N",
    "morpholine": "N1CCOCC1",
    "piperazine": "N1CCNCC1",
    "piperidine": "C1CCNCC1",
    "formaldehyde": "C=O",
    "acetone": "CC(=O)C",
    "ethanol": "CCO",
    "bromoethane": "CCBr",
    "cinnamic acid": "OC(=O)C=Cc1ccccc1",
    "Boc-piperazine": "CC(C)(C)OC(=O)N1CCNCC1",
}


# ── Knowledge graph (networkx) ──────────────────────────────────────────────

_FUNCTION_GROUPS = {
    "carboxylic acid": "[CX3](=O)[OX2H1]",
    "amine": "[NX3H2,NX3H1]",
    "amide": "[CX3](=O)[NX3]",
    "sulfonamide": "[SX4](=O)(=O)[NX3]",
    "urea": "[NX3][CX3](=O)[NX3]",
    "aryl halide": "[c][F,Cl,Br,I]",
    "alkyl halide": "[CX4][F,Cl,Br,I]",
    "boronic acid": "[BX3]",
    "alcohol": "[OX2H]",
    "ether": "[OX2H0][#6]",
    "carbonyl": "[CX3]=[OX1]",
    "biaryl": "[c][c]",
}


def build_knowledge_graph():
    """Graph of functional-group nodes ↔ reaction-template nodes."""
    import networkx as nx

    g = nx.DiGraph()
    for fg_name, smarts in _FUNCTION_GROUPS.items():
        g.add_node(fg_name, kind="functional_group", smarts=smarts)
    for name in BUILDING_BLOCKS:
        g.add_node(f"bb:{name}", kind="building_block", smiles=BUILDING_BLOCKS[name])
    for tpl in REACTION_TEMPLATES:
        g.add_node(f"rxn:{tpl.name}", kind="reaction", confidence=tpl.confidence)
        reactant_fg = {
            fg for fg, patt in _FUNCTION_GROUPS.items() if _mentions(tpl.forward_smarts, patt)
        }
        for fg in reactant_fg:
            g.add_edge(fg, f"rxn:{tpl.name}", kind="consumes")
        for other in _FUNCTION_GROUPS:
            if other not in reactant_fg:
                g.add_edge(f"rxn:{tpl.name}", other, kind="produces")
    return g


def _mentions(forward_smarts: str, smarts: str) -> bool:
    patt = Chem.MolFromSmarts(smarts)
    if patt is None:
        return False
    try:
        rxn = AllChem.ReactionFromSmarts(forward_smarts)
        return any(rt.HasSubstructMatch(patt) for rt in rxn.GetReactants())
    except Exception:  # noqa: BLE001
        return False


def kg_stats() -> dict:
    g = build_knowledge_graph()
    kinds: dict[str, int] = {}
    for _, data in g.nodes(data=True):
        k = data.get("kind", "?")
        kinds[k] = kinds.get(k, 0) + 1
    return {
        "templates": len(REACTION_TEMPLATES),
        "building_blocks": len(BUILDING_BLOCKS),
        "nodes": g.number_of_nodes(),
        "edges": g.number_of_edges(),
        "breakdown": kinds,
        "reactions": [
            {"name": t.name, "confidence": t.confidence, "conditions": t.conditions,
             "reagents": t.reagents, "typical_yield": t.typical_yield, "notes": t.notes}
            for t in REACTION_TEMPLATES
        ],
    }


# ── Retrosynthetic planning ─────────────────────────────────────────────────

_BLOCK_SMILES = {Chem.MolToSmiles(Chem.MolFromSmiles(s)): n for n, s in BUILDING_BLOCKS.items()}


def plan_synthesis(target_smiles: str, max_steps: int = 4, budget: int = 400):
    """DFS retro-planner over the KG. Returns a plan dict or None.

    plan = {
        complete, confidence, overall_yield,
        steps: [{step, reaction_name, reactants, product, reagents, conditions,
                 confidence, typical_yield, notes}],
        starting_materials: [smiles],
    }
    """
    from utils import chemistry

    ok, target_canon, err = chemistry.canonicalize(target_smiles)
    if not ok:
        raise ValueError(err)

    counter = {"calls": 0}

    def is_block(canon: str) -> bool:
        return canon in _BLOCK_SMILES

    def search(canon: str, depth: int, visited: set[str]) -> Optional[dict]:
        if is_block(canon):
            return {"complete": True, "confidence": 1.0, "overall_yield": 1.0,
                    "steps": [], "starting_materials": [canon]}
        if depth <= 0 or canon in visited or counter["calls"] > budget:
            return None
        counter["calls"] += 1
        mol = Chem.MolFromSmiles(canon)
        if mol is None:
            return None
        best: Optional[dict] = None
        for tpl in REACTION_TEMPLATES:
            counter["calls"] += 1
            if counter["calls"] > budget:
                break
            try:
                rxn = tpl.compiled_retro()
                result_sets = list(rxn.RunReactants((mol,)))[:3]
            except Exception as exc:  # noqa: BLE001
                log.debug("retro failed for %s: %s", tpl.name, exc)
                continue
            for products in result_sets:
                precursors: list[str] = []
                valid = True
                for p in products:
                    try:
                        ok_p, p_canon, _ = chemistry.canonicalize(Chem.MolToSmiles(p))
                    except Exception:  # noqa: BLE001
                        ok_p, p_canon = False, ""
                    if not ok_p:
                        valid = False
                        break
                    precursors.append(p_canon)
                if not valid or not precursors or canon in precursors:
                    continue
                conf = tpl.confidence
                sub_plans: list[Optional[dict]] = []
                for prec in precursors:
                    sub = search(prec, depth - 1, visited | {canon})
                    sub_plans.append(sub)
                    if sub is None:
                        break
                    conf *= sub["confidence"]
                if any(s is None for s in sub_plans):
                    continue
                steps: list[dict] = []
                starting: list[str] = []
                complete = True
                for s in sub_plans:
                    steps += s["steps"]
                    starting += s["starting_materials"]
                    complete = complete and s["complete"]
                steps.append({
                    "step": len(steps) + 1,
                    "reaction_name": tpl.name,
                    "reactants": precursors,
                    "product": canon,
                    "reagents": tpl.reagents,
                    "conditions": tpl.conditions,
                    "confidence": round(conf, 3),
                    "typical_yield": tpl.typical_yield,
                    "notes": tpl.notes,
                })
                candidate = {
                    "complete": complete,
                    "confidence": round(conf, 4),
                    "overall_yield": min(s["overall_yield"] for s in sub_plans),
                    "steps": steps,
                    "starting_materials": sorted(set(starting)),
                }
                if best is None or candidate["confidence"] > best["confidence"]:
                    best = candidate
        return best

    plan = search(target_canon, max_steps, set())
    if plan is None:
        return None
    for i, s in enumerate(plan["steps"], start=1):
        s["step"] = i
    yield_lo = [float(s["typical_yield"].split("–")[0]) / 100 for s in plan["steps"]]
    plan["overall_yield"] = round(_prod(yield_lo), 4)
    return plan


def _prod(values) -> float:
    out = 1.0
    for v in values:
        out *= v
    return out