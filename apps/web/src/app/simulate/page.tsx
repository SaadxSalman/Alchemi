"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Activity, CheckCircle2, XCircle } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/components/ui/primitives";
import { AgentLog, AgentThinking } from "@/components/agents/agent-log";
import { MoleculeViewer } from "@/components/molecules/molecule-viewer";

const THINKING_LINES = [
  "Parsing and canonicalizing the structure…",
  "Computing the full RDKit descriptor suite…",
  "Screening Lipinski / Veber rules and PAINS catalogs…",
  "Running GATv2 property inference + MMFF conformer analysis…",
];

const EXAMPLES = [
  { label: "Aspirin", smiles: "CC(=O)Oc1ccccc1C(=O)O" },
  { label: "Caffeine", smiles: "Cn1cnc2c1c(=O)n(C)c(=O)n2C" },
  { label: "Ibuprofen", smiles: "CC(C)Cc1ccc(C(C)C(=O)O)cc1" },
  { label: "Sulfanilamide", smiles: "Nc1ccc(S(N)(=O)=O)cc1" },
];

function SimulatePageInner() {
  const params = useSearchParams();
  const [smiles, setSmiles] = useState("");
  const simulate = trpc.agents.simulate.useMutation();

  useEffect(() => {
    const prefill = params.get("smiles");
    if (prefill) {
      setSmiles(prefill);
      simulate.mutate({ smiles: prefill });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = (value?: string) => {
    const s = (value ?? smiles).trim();
    if (!s) return;
    setSmiles(s);
    simulate.mutate({ smiles: s });
  };

  const d = simulate.data?.descriptors;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Activity className="h-7 w-7 text-primary" /> Simulation Agent
        </h1>
        <p className="text-muted-foreground">
          Models the properties and behavior of a molecule: ADME descriptors, drug-likeness
          rules, structural alerts, GATv2 property inference and conformer energetics.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label>Molecule (SMILES)</Label>
            <div className="flex gap-2">
              <Input className="mono" placeholder="CC(=O)Oc1ccccc1C(=O)O" value={smiles}
                onChange={(e) => setSmiles(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()} />
              <Button disabled={smiles.trim().length < 1 || simulate.isPending} onClick={() => run()}>
                {simulate.isPending ? "Simulating…" : "Run simulation"}
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
          {simulate.isError ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-red-400">{simulate.error.message}</p>
          ) : null}
        </CardContent>
      </Card>

      {simulate.isPending ? (
        <Card>
          <CardHeader><CardTitle>Agent pipeline</CardTitle></CardHeader>
          <CardContent><AgentThinking lines={THINKING_LINES} /></CardContent>
        </Card>
      ) : simulate.data ? (
        !simulate.data.valid ? (
          <Card>
            <CardContent className="p-6 text-sm text-red-400">{simulate.data.error || "Invalid SMILES"}</CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <div className="space-y-4">
              <Card>
                <CardContent className="space-y-3 p-4">
                  <MoleculeViewer smiles={simulate.data.canonical_smiles} width={340} height={260} />
                  <p className="mono break-all text-[11px] text-muted-foreground">{simulate.data.canonical_smiles}</p>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Drug-likeness</span>
                      <span className="font-bold text-primary">{simulate.data.drug_likeness_score}/100</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${simulate.data.drug_likeness_score}%` }} />
                    </div>
                  </div>
                  {simulate.data.conformer.generated ? (
                    <p className="text-xs text-muted-foreground">
                      Conformer: {simulate.data.conformer.method}
                      {simulate.data.conformer.energy_kcal_mol !== null
                        ? ` · E = ${simulate.data.conformer.energy_kcal_mol} kcal/mol`
                        : ""}
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Predicted properties</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {simulate.data.predicted ? (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">logP</span><span>{simulate.data.predicted.logp}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">TPSA</span><span>{simulate.data.predicted.tpsa} Å²</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">logS (solubility)</span><span>{simulate.data.predicted.log_solubility}</span></div>
                      <Badge variant="secondary" className="mt-1">{simulate.data.predicted.model}</Badge>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Molecular descriptors</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {d ? [
                    ["Molecular weight", `${d.molecular_weight} Da`],
                    ["logP", String(d.logp)],
                    ["TPSA", `${d.tpsa} Å²`],
                    ["H-bond donors", String(d.hbd)],
                    ["H-bond acceptors", String(d.hba)],
                    ["Rotatable bonds", String(d.rotatable_bonds)],
                    ["QED", String(d.qed)],
                    ["Fsp³", String(d.fraction_csp3)],
                    ["Rings", String(d.ring_count)],
                    ["Aromatic rings", String(d.aromatic_rings)],
                    ["Heavy atoms", String(d.heavy_atoms)],
                    ["Formal charge", String(d.formal_charge)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-secondary/40 p-3">
                      <p className="text-lg font-semibold">{value}</p>
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                    </div>
                  )) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Rule checks</CardTitle></CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                  {simulate.data.rule_checks.map((r) => (
                    <div key={r.name} className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2">
                      {r.passed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                      )}
                      <span className="text-sm">{r.name}</span>
                      <span className="mono ml-auto text-[10px] text-muted-foreground">{r.detail}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {simulate.data.alerts.length > 0 ? (
                <Card>
                  <CardHeader><CardTitle className="text-base">Structural alerts</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {simulate.data.alerts.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm">
                        <Badge variant="danger">{a.source}</Badge>
                        {a.description}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader><CardTitle className="text-base">Agent analysis</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <AgentLog steps={simulate.data.agent_steps} dense />
                  <p className="rounded-lg bg-secondary/40 p-4 text-sm leading-relaxed">{simulate.data.narrative}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )
      ) : (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Enter a SMILES string or pick an example to simulate.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SimulatePage() {
  return (
    <Suspense>
      <SimulatePageInner />
    </Suspense>
  );
}