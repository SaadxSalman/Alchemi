"use client";

import { useEffect, useState } from "react";
import { useRDKit } from "@/hooks/use-rdkit";
import { SERVER_URL } from "@/utils/trpc";
import { Skeleton } from "@/components/ui/primitives";
import { cn } from "@/utils/misc";

/**
 * High-fidelity 2D molecule renderer.
 * 1. Preferred: RDKit.js (MinimalLib) rendered locally in the browser.
 * 2. Fallback: server-side RDKit render proxy (/rest/render).
 * 3. Last resort: SMILES text.
 */
export function MoleculeViewer({
  smiles,
  width = 320,
  height = 240,
  className,
}: {
  smiles: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const { ready, failed } = useRDKit();
  const [svg, setSvg] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (!ready || !smiles) {
      setSvg(null);
      return;
    }
    try {
      const mol = window.RDKit?.get_mol(smiles);
      if (!mol) {
        setSvg(null);
        return;
      }
      const rendered = mol.get_svg(width, height);
      mol.delete();
      setSvg(rendered);
    } catch {
      setSvg(null);
    }
  }, [ready, smiles, width, height]);

  if (!smiles) {
    return (
      <div className={cn("flex items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground", className)}
        style={{ width, height }}>
        No structure
      </div>
    );
  }

  if (svg) {
    return (
      <div
        className={cn("overflow-hidden rounded-lg bg-white/95 p-1", className)}
        style={{ width: "100%", maxWidth: width }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  if (!failed && !ready) {
    return <Skeleton className={cn("rounded-lg", className)} style={{ width: "100%", maxWidth: width, height } as never} />;
  }

  if (!imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`${SERVER_URL}/rest/render?smiles=${encodeURIComponent(smiles)}&w=${width}&h=${height}`}
        alt={`2D structure of ${smiles}`}
        width={width}
        height={height}
        onError={() => setImgFailed(true)}
        className={cn("rounded-lg bg-white/95 p-1", className)}
        style={{ width: "100%", maxWidth: width }}
      />
    );
  }

  return (
    <div
      className={cn("mono flex items-center justify-center rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground", className)}
      style={{ width: "100%", maxWidth: width, minHeight: height / 3 }}
    >
      {smiles}
    </div>
  );
}
