"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, Atom, FlaskConical, LayoutDashboard, LibraryBig, Network,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/utils/misc";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/design", label: "Design", icon: FlaskConical },
  { href: "/pathway", label: "Pathways", icon: Network },
  { href: "/simulate", label: "Simulate", icon: Activity },
  { href: "/library", label: "Library", icon: LibraryBig },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const health = trpc.health.check.useQuery(undefined, {
    refetchInterval: 15_000,
    retry: false,
  });

  const aiOk = health.data?.ai?.ok === true;
  const dbMode = health.data?.db?.mode ?? "…";

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/60 bg-card/40 p-4 md:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2 pt-2">
          <Atom className="h-7 w-7 text-primary" />
          <div>
            <p className="text-lg font-bold tracking-tight">Alchemi</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Chem-Agent</p>
          </div>
        </Link>
        <nav className="flex-1 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/15 font-medium text-primary"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>AI Engine</span>
            <Badge variant={aiOk ? "success" : "danger"}>{aiOk ? "online" : "offline"}</Badge>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Database</span>
            <Badge variant={dbMode === "mongo" ? "success" : "warning"}>{dbMode}</Badge>
          </div>
          {aiOk && health.data?.ai?.gatv2_loaded ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>GATv2</span>
              <Badge variant="success">loaded</Badge>
            </div>
          ) : null}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <Atom className="h-5 w-5 text-primary" />
            <span className="font-bold">Alchemi</span>
          </Link>
          <nav className="flex gap-1">
            {NAV.map(({ href, icon: Icon }) => (
              <Link key={href} href={href} className="rounded-md p-2 hover:bg-secondary/60">
                <Icon className="h-4 w-4" />
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
