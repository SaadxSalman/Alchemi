"use client";

import { useEffect, useState } from "react";
import { Brain, Cog, Eye, MessageSquare } from "lucide-react";
import { cn } from "@/utils/misc";

export interface AgentStepView {
  step: number;
  level: string;
  message: string;
  detail?: string;
  duration_ms?: number;
}

const LEVEL_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  thought: { icon: Brain, color: "text-emerald-400", label: "thought" },
  tool: { icon: Cog, color: "text-cyan-400", label: "tool" },
  observation: { icon: Eye, color: "text-amber-300", label: "observation" },
  answer: { icon: MessageSquare, color: "text-accent", label: "answer" },
};

/** Animated "agent thinking" console — replays the reasoning trace. */
export function AgentLog({ steps, dense = false }: { steps: AgentStepView[]; dense?: boolean }) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    setVisible(0);
    if (!steps.length) return;
    const timer = setInterval(() => {
      setVisible((v) => {
        if (v >= steps.length) {
          clearInterval(timer);
          return v;
        }
        return v + 1;
      });
    }, 260);
    return () => clearInterval(timer);
  }, [steps]);

  return (
    <ol className="space-y-2">
      {steps.slice(0, visible).map((s) => {
        const meta = LEVEL_META[s.level] ?? LEVEL_META.thought;
        const Icon = meta.icon;
        return (
          <li
            key={s.step}
            className={cn(
              "animate-fade-in-up rounded-lg border border-border/70 bg-background/50",
              dense ? "px-3 py-1.5" : "px-4 py-2.5"
            )}
          >
            <div className="flex items-start gap-2.5">
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.color)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{s.message}</p>
                {s.detail ? (
                  <p className="mono mt-0.5 break-words text-[11px] text-muted-foreground">{s.detail}</p>
                ) : null}
              </div>
              {typeof s.duration_ms === "number" && s.duration_ms > 0 ? (
                <span className="mono shrink-0 text-[10px] text-muted-foreground/70">
                  {s.duration_ms}ms
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Optimistic pipeline shown while an agent is still running. */
export function AgentThinking({ lines }: { lines: string[] }) {
  return (
    <div className="space-y-2">
      {lines.map((line, i) => (
        <div key={i} className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/50 px-4 py-2.5">
          <Cog className="h-4 w-4 shrink-0 animate-spin text-cyan-400" style={{ animationDuration: "2.5s" }} />
          <span className={cn("text-sm", i === lines.length - 1 ? "text-foreground" : "text-muted-foreground/70")}>
            {line}
          </span>
        </div>
      ))}
    </div>
  );
}
