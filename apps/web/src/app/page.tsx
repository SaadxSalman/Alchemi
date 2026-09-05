"use client";

import Link from "next/link";
import {
  ArrowRight, FlaskConical, LibraryBig, Network, Activity, Sparkles,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { Badge, Card, CardContent, Skeleton } from "@/components/ui/primitives";
import { formatDate } from "@/utils/misc";

const AGENT_LABEL: Record<string, string> = {
  "molecule-design": "Molecule Design",
  "reaction-prediction": "Pathway Planning",
  simulation: "Simulation",
};

const QUICK_ACTIONS = [
  { href: "/design", title: "Design molecules", desc: "Describe an objective; agents propose novel structures.", icon: FlaskConical },
  { href: "/pathway", title: "Plan a synthesis", desc: "Retrosynthetic routes from the reaction knowledge graph.", icon: Network },
  { href: "/simulate", title: "Simulate a molecule", desc: "ADME descriptors, rule checks and GATv2 inference.", icon: Activity },
  { href: "/library", title: "Molecule library", desc: "Browse, inspect and manage saved structures.", icon: LibraryBig },
];

export default function DashboardPage() {
  const health = trpc.health.check.useQuery(undefined, { refetchInterval: 20_000, retry: false });
  const runsStats = trpc.runs.stats.useQuery(undefined);
  const molecules = trpc.molecules.list.useQuery({ limit: 200 });
  const recentRuns = trpc.runs.list.useQuery({ limit: 6 });

  const kg = (health.data?.ai?.knowledge_graph ?? {}) as {
    templates?: number; building_blocks?: number; nodes?: number; edges?: number;
  };

  const stats = [
    { label: "Molecules in library", value: molecules.data?.length, icon: LibraryBig },
    { label: "Agent runs", value: runsStats.data?.total, icon: Sparkles },
    { label: "Reaction templates", value: kg.templates, icon: Network },
    { label: "Building blocks", value: kg.building_blocks, icon: FlaskConical },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Laboratory Dashboard</h1>
        <p className="text-muted-foreground">
          Alchemi&apos;s autonomous agents design novel molecules, plan their synthesis and
          validate feasibility — powered by RDKit, a GATv2 graph network and LLM reasoning.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                {value === undefined ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  <p className="text-2xl font-bold">{value}</p>
                )}
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {QUICK_ACTIONS.map(({ href, title, desc, icon: Icon }) => (
            <Link key={href} href={href}>
              <Card className="group h-full transition-colors hover:border-primary/50">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="rounded-lg bg-accent/10 p-2.5">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {title}
                      <ArrowRight className="ml-1.5 inline h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Recent agent activity</h2>
          {recentRuns.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : recentRuns.data && recentRuns.data.length > 0 ? (
            <div className="space-y-2">
              {recentRuns.data.map((run) => (
                <Card key={run.id}>
                  <CardContent className="p-4">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <Badge variant="accent">{AGENT_LABEL[run.agent] ?? run.agent}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(run.createdAt)}</span>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {run.summary || JSON.stringify(run.input)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No agent runs yet — start with the{" "}
                <Link href="/design" className="text-primary underline-offset-2 hover:underline">
                  Molecule Design Agent
                </Link>
                .
              </CardContent>
            </Card>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Knowledge graph</h2>
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm text-muted-foreground">
                The reaction knowledge graph connects functional groups through named
                transformations, enabling retrosynthetic planning.
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-xl font-bold text-primary">{kg.templates ?? "–"}</p>
                  <p className="text-[11px] text-muted-foreground">reactions</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-xl font-bold text-accent">{kg.nodes ?? "–"}</p>
                  <p className="text-[11px] text-muted-foreground">nodes</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-xl font-bold text-amber-300">{kg.edges ?? "–"}</p>
                  <p className="text-[11px] text-muted-foreground">edges</p>
                </div>
              </div>
              {runsStats.data?.lastRunAt ? (
                <p className="text-xs text-muted-foreground">
                  Last agent run: {formatDate(runsStats.data.lastRunAt)}
                </p>
              ) : null}
            </CardContent>
          </Card>
          {health.data?.ai?.llm ? (
            <Card>
              <CardContent className="flex items-center justify-between p-4 text-sm">
                <span className="text-muted-foreground">Chemical intelligence</span>
                <Badge
                  variant={
                    (health.data.ai.llm as { provider?: string }).provider === "openai"
                      ? "success"
                      : "secondary"
                  }
                >
                  {String((health.data.ai.llm as { model?: string }).model ?? "rule-based")}
                </Badge>
              </CardContent>
            </Card>
          ) : null}
        </section>
      </div>
    </div>
  );
}