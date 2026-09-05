/** Minimal typings for RDKit MinimalLib (loaded from CDN at runtime). */
export interface RDKitModule {
  version: string;
  get_mol(smiles: string): RDKitMol | null;
  get_qmol(smiles: string): RDKitMol | null;
}

export interface RDKitMol {
  is_valid(): boolean;
  get_smiles(): string;
  get_svg(width?: number, height?: number): string;
  get_molblock(): string;
  delete(): void;
}

declare global {
  interface Window {
    RDKit?: RDKitModule;
    initRDKitModule?: () => Promise<RDKitModule>;
  }
}

export {};
