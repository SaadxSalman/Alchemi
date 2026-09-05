"use client";

import { useEffect, useState } from "react";
import type { RDKitModule } from "@/types/rdkit";

/**
 * Loads RDKit MinimalLib (WASM) once and exposes it when ready.
 * Falls back gracefully (the MoleculeViewer uses the server-side RDKit
 * render proxy when RDKit.js is unavailable, e.g. offline).
 */
export function useRDKit() {
  const [rdkit, setRdkit] = useState<RDKitModule | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const tryInit = async (): Promise<boolean> => {
      const w = typeof window !== "undefined" ? window : undefined;
      if (!w) return false;
      if (w.RDKit) {
        if (!cancelled) setRdkit(w.RDKit);
        return true;
      }
      if (typeof w.initRDKitModule === "function") {
        try {
          const mod = await w.initRDKitModule();
          w.RDKit = mod;
          if (!cancelled) setRdkit(mod);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    };

    const interval = setInterval(async () => {
      attempts += 1;
      const ok = await tryInit();
      if (ok || attempts > 40) {
        clearInterval(interval);
        if (!ok && !cancelled) setFailed(true);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { rdkit, ready: rdkit !== null, failed };
}
