"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LibraryBig, Plus, Search, Trash2 } from "lucide-react";
import { trpc } from "@/utils/trpc";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label,
} from "@/components/ui/primitives";
import { MoleculeViewer } from "@/components/molecules/molecule-viewer";
import { formatDate } from "@/utils/misc";

export default function LibraryPage() {
  const molecules = trpc.molecules.list.useQuery({ limit: 300 });
  const deleteMolecule = trpc.molecules.delete.useMutation();
  const saveMolecule = trpc.molecules.save.useMutation();
  const utils = trpc.useUtils();

  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [smiles, setSmiles] = useState("");
  const [saveError, setSaveError] = useState("");

  const filtered = useMemo(() => {
    const list = molecules.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.smiles.toLowerCase().includes(q) ||
        (m.description ?? "").toLowerCase().includes(q)
    );
  }, [molecules.data, query]);

  const add = () => {
    setSaveError("");
    if (!name.trim() || !smiles.trim()) {
      setSaveError("Name and SMILES are both required.");
      return;
    }
    saveMolecule.mutate(
      { name: name.trim(), smiles: smiles.trim(), source: "manual", tags: [] },
      {
        onSuccess: () => {
          setName("");
          setSmiles("");
          setShowAdd(false);
          utils.molecules.list.invalidate();
        },
        onError: (err) => setSaveError(err.message),
      }
    );
  };

  const remove = (id: string) => {
    deleteMolecule.mutate(
      { id },
      { onSuccess: () => utils.molecules.list.invalidate() }
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <LibraryBig className="h-7 w-7 text-primary" /> Molecule Library
          </h1>
          <p className="text-muted-foreground">
            Every structure you save from the agents — or add by hand — lives here.
          </p>
        </div>
        <Button onClick={() => setShowAdd((v) => !v)}>
          <Plus className="h-4 w-4" /> Add molecule
        </Button>
      </header>

      {showAdd ? (
        <Card>
          <CardHeader><CardTitle>Add a molecule manually</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input placeholder="e.g. My lead candidate" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>SMILES</Label>
                <Input className="mono" placeholder="e.g. CC(=O)Oc1ccccc1C(=O)O" value={smiles}
                  onChange={(e) => setSmiles(e.target.value)} />
              </div>
            </div>
            {saveError ? <p className="text-xs text-red-400">{saveError}</p> : null}
            <div className="flex gap-2">
              <Button size="sm" disabled={saveMolecule.isPending} onClick={add}>
                {saveMolecule.isPending ? "Validating…" : "Save molecule"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              SMILES are validated (and canonicalized) by the AI engine&apos;s RDKit service before saving.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, SMILES or description…" value={query}
          onChange={(e) => setQuery(e.target.value)} />
      </div>

      {molecules.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}><CardContent className="h-64" /></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {query ? "No molecules match your search." : "The library is empty — design some molecules first."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <Card key={m.id} className="group overflow-hidden">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium" title={m.name}>{m.name}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(m.createdAt)}</p>
                  </div>
                  <Badge variant={m.source === "designed" ? "accent" : m.source === "example" ? "secondary" : "outline"}>
                    {m.source}
                  </Badge>
                </div>
                <MoleculeViewer smiles={m.smiles} width={300} height={200} />
                <p className="mono truncate text-[11px] text-muted-foreground" title={m.smiles}>{m.smiles}</p>
                {m.description ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{m.description}</p>
                ) : null}
                <div className="flex gap-2 pt-1">
                  <Link href={`/simulate?smiles=${encodeURIComponent(m.smiles)}`} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full">Simulate</Button>
                  </Link>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10"
                    disabled={deleteMolecule.isPending} onClick={() => remove(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}