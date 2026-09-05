"use client";

import { useState } from "react";
import { Network } from "lucide-react";
import { trpc } from "@/utils/trpc";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label,
} from "@/components/ui/primitives";
import { AgentLog, AgentThinking } from "@/components/agents/agent-log";
import { MoleculeViewer } from "@/components/molecules/molecule-viewer";

const THINKING_LINES = [
  "Loading reaction knowledge graph…",
  "Identifying disconnections in the target…",
  "Walking retrosynthetic tree toward commercial building blocks…",
  "Ranking routes by confidence and yield…",
];

const EXAMPLES = [
  { label: "N-phenylbenzamide", smiles: "O=C(Nc1ccccc1)c1ccccc1" },
  { label: "1-benzylpiperidine", smiles: "C1CCN(CC1)Cc2ccccc2" },
  { label: "4-phenylmorpholine", smiles: "c1ccc(cc1)N2CCOCC2" },
];

export default function PathwayPage() {
  const [target, setTarget] = useState("");
  const [maxSteps, setMaxSteps] = useState(4);
  const pathway = trpc.agents.predictPathway.useMutation();

  const run = (smiles?: string) => {
    const t = (smiles ?? target).trim();
    if (t.length < 1) return;
    setTarget(t);
    pathway.mutate({ targetSmiles: t, maxSteps });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Network className="h-7 w-7 text-primary" /> Reaction Prediction Agent
        </h1>
        <p className="text-muted-foreground">
          Propose viable synthesis pathways for a target molecule by walking the reaction
          knowledge graph backwards to commercially available starting materials.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label>Target molecule (SMILES)</Label>
            <div className="flex gap-2">
              <Input
                className="mono"
                placeholder="e.g. O=C(Nc1ccccc1)c1ccccc1"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
              />
              <Button disabled={target.trim().length < 1 || pathway.isPending} onClick={() => run()}>
                {pathway.isPending ? "Planning…" : "Plan synthesis"}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Examples:</span>
            {EXAMPLES.map((ex) => (
              <button key={ex.smiles} type="button" onClick={() => run(ex.smiles)}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary">
                {ex.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Label>Max steps</Label>
            {[2, 3, 4, 5, 6].map((n) => (
              <button key={n} type="button" onClick={() => setMaxSteps(n)}
                className={`h-8 w-8 rounded-full text-xs font-medium transition-colors ${
                  maxSteps === n ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}>
                {n}
              </button>
            ))}
          </div>
          {pathway.isError ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-red-400">{pathway.error.message}</p>
          ) : null}
        </CardContent>
      </Card>

      {pathway.isPending ? (
        <Card>
          <CardHeader><CardTitle>Agent pipeline</CardTitle></CardHeader>
          <CardContent><AgentThinking lines={THINKING_LINES} /></CardContent>
        </Card>
      ) : pathway.data ? (
        pathway.data.valid ? (
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle>Proposed route</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant={pathway.data.is_complete ? "success" : "warning"}>
                  {pathway.data.is_complete ? "Complete route" : "Partial route"}
                </Badge>
                <Badge variant="secondary">confidence {(pathway.data.overall_confidence * 100).toFixed(0)}%</Badge>
                <Badge variant="accent">est. yield {pathway.data.estimated_overall_yield}%</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <AgentLog steps={pathway.data.agent_steps} dense />
              {pathway.data.steps.map((step) => (
                <div key={step.step} className="rounded-xl border border-border/70 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                        {step.step}
                      </span>
                      <span className="font-medium">{step.reaction_name}</span>
                    </div>
                    <Badge variant="secondary">yield {step.typical_yield}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {step.reactants.map((r) => (
                      <div key={r} className="min-w-[120px]">
                        <MoleculeViewer smiles={r} width={150} height={110} />
                        <p className="mono mt-1 max-w-[150px] truncate text-[10px] text-muted-foreground" title={r}>{r}</p>
                      </div>
                    ))}
                    <span className="text-xl text-primary">→</span>
                    <div className="min-w-[120px]">
                      <MoleculeViewer smiles={step.product} width={170} height={120} />
                      <p className="mono mt-1 max-w-[170px] truncate text-[10px] text-muted-foreground" title={step.product}>{step.product}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {step.reagents.map((rg) => <Badge key={rg} variant="outline">{rg}</Badge>)}
                    <Badge variant="default">{step.conditions}</Badge>
                  </div>
                </div>
              ))}
              <p className="rounded-lg bg-secondary/40 p-4 text-sm leading-relaxed">{pathway.data.narrative}</p>
              {pathway.data.starting_materials.length > 0 ? (
                <div className="space-y-1.5">
                  <Label>Commercial starting materials</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {pathway.data.starting_materials.map((s) => (
                      <Badge key={s} variant="secondary" className="mono">{s}</Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-red-400">{pathway.data.error}</CardContent>
          </Card>
        )
      ) : null}
    </div>
  );
}