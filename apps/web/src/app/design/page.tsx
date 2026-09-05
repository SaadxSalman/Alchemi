"use client";

import { useState } from "react";
import { FlaskConical, Save, Sparkles } from "lucide-react";
import { trpc } from "@/utils/trpc";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Label, RangeField,
  Select, Textarea, Toggle,
} from "@/components/ui/primitives";
import { AgentLog, AgentThinking } from "@/components/agents/agent-log";
import { MoleculeViewer } from "@/components/molecules/molecule-viewer";

const THINKING_LINES = [
  "Parsing objective and property envelope…",
  "Consulting chemical knowledge (LLM + fragment engine)…",
  "Enumerating and validating candidate structures with RDKit…",
  "Scoring candidates with the GATv2 property model…",
];

const OBJECTIVE_EXAMPLES = [
  "A brain-penetrant kinase inhibitor with low polar surface area",
  "Potent antimicrobial scaffold with balanced lipophilicity",
  "Soluble, low-MW anti-inflammatory candidate",
];

export default function DesignPage() {
  const [objective, setObjective] = useState("");
  const [numCandidates, setNumCandidates] = useState(5);
  const [mwMax, setMwMax] = useState(500);
  const [logpMax, setLogpMax] = useState(5);
  const [tpsaMax, setTpsaMax] = useState(140);
  const [drugLike, setDrugLike] = useState(true);
  const [avoidPains, setAvoidPains] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const design = trpc.agents.design.useMutation();
  const saveMolecule = trpc.molecules.save.useMutation();
  const utils = trpc.useUtils();

  const run = () => {
    if (objective.trim().length < 3) return;
    design.mutate({
      objective: objective.trim(),
      numCandidates,
      targets: {
        mw_min: 120, mw_max: mwMax, logp_min: -0.5, logp_max: logpMax,
        tpsa_min: 0, tpsa_max: tpsaMax, hbd_max: 5, hba_max: 10,
      },
      drugLike, avoidPains,
    });
  };

  const save = (smiles: string, score: number) => {
    saveMolecule.mutate(
      {
        name: `Designed · ${smiles.slice(0, 24)}…`,
        smiles,
        description: `Designed by the Molecule Design Agent (score ${score}/100). Objective: ${objective.trim()}`,
        source: "designed",
        tags: ["designed", "agent"],
      },
      {
        onSuccess: () => {
          setSavedIds((prev) => new Set(prev).add(smiles));
          utils.molecules.list.invalidate();
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <FlaskConical className="h-7 w-7 text-primary" /> Molecule Design Agent
        </h1>
        <p className="text-muted-foreground">
          Describe the molecule you need. The agent proposes novel structures via LLM
          reasoning + a fragment-based generative engine, scored by GATv2 and filtered
          for drug-likeness and PAINS alerts.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit">
          <CardHeader><CardTitle>Design brief</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Research objective</Label>
              <Textarea
                placeholder="e.g. A selective, orally available inhibitor with low hERG risk…"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {OBJECTIVE_EXAMPLES.map((ex) => (
                  <button key={ex} type="button" onClick={() => setObjective(ex)}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary">
                    {ex.slice(0, 38)}…
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Candidates to return</Label>
              <Select value={numCandidates} onChange={(e) => setNumCandidates(Number(e.target.value))}>
                {[3, 5, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>{n} candidates</option>
                ))}
              </Select>
            </div>

            <div className="space-y-3 rounded-lg border border-border/70 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Property envelope
              </p>
              <RangeField label="Max molecular weight" value={mwMax} min={200} max={800} step={10} unit=" Da" onChange={setMwMax} />
              <RangeField label="Max logP" value={logpMax} min={1} max={8} step={0.5} onChange={setLogpMax} />
              <RangeField label="Max TPSA" value={tpsaMax} min={40} max={220} step={10} unit=" Å²" onChange={setTpsaMax} />
            </div>

            <div className="flex gap-6">
              <Toggle checked={drugLike} onChange={setDrugLike} label="Prefer drug-like" />
              <Toggle checked={avoidPains} onChange={setAvoidPains} label="Avoid PAINS" />
            </div>

            <Button className="w-full" size="lg" disabled={objective.trim().length < 3 || design.isPending} onClick={run}>
              <Sparkles className="h-4 w-4" />
              {design.isPending ? "Agents are thinking…" : "Transmute"}
            </Button>
            {design.isError ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-red-400">
                {design.error.message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* ── Results ── */}
        <div className="space-y-4">
          {design.isPending ? (
            <Card>
              <CardHeader><CardTitle>Agent pipeline</CardTitle></CardHeader>
              <CardContent><AgentThinking lines={THINKING_LINES} /></CardContent>
            </Card>
          ) : design.data ? (
            <>
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle>Agent reasoning</CardTitle>
                  <Badge variant="secondary">{design.data.llm_provider}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AgentLog steps={design.data.agent_steps} dense />
                  <p className="rounded-lg bg-secondary/40 p-4 text-sm leading-relaxed">
                    {design.data.summary}
                  </p>
                </CardContent>
              </Card>

              <div className="grid gap-4 xl:grid-cols-2">
                {design.data.candidates.map((c) => (
                  <Card key={c.smiles} className="overflow-hidden">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={c.rank === 1 ? "success" : "secondary"}>#{c.rank}</Badge>
                          <span className="text-lg font-bold text-primary">{c.score.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">/100</span>
                        </div>
                        <Badge variant={c.origin === "llm" ? "accent" : "secondary"}>{c.origin}</Badge>
                      </div>
                      <MoleculeViewer smiles={c.smiles} width={340} height={220} />
                      <p className="mono break-all text-[11px] text-muted-foreground">{c.smiles}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline">MW {c.descriptors.molecular_weight}</Badge>
                        <Badge variant="outline">logP {c.descriptors.logp}</Badge>
                        <Badge variant="outline">TPSA {c.descriptors.tpsa}</Badge>
                        <Badge variant="outline">logS {c.predicted.log_solubility}</Badge>
                        {c.passes_lipinski ? <Badge variant="success">Lipinski ✓</Badge> : <Badge variant="warning">Lipinski ✗</Badge>}
                        {c.alerts.length > 0 ? <Badge variant="danger">{c.alerts.length} alert(s)</Badge> : null}
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">{c.rationale}</p>
                      <Button size="sm" variant="outline" className="w-full"
                        disabled={savedIds.has(c.smiles) || saveMolecule.isPending}
                        onClick={() => save(c.smiles, c.score)}>
                        <Save className="h-3.5 w-3.5" />
                        {savedIds.has(c.smiles) ? "Saved to library ✓" : "Save to library"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                Configure the brief and press <span className="font-medium text-primary">Transmute</span> to
                run the design pipeline.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}