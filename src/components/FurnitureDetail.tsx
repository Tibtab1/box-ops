"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";

type FurnitureContents = {
  parent: {
    id: string;
    name: string;
    color: string;
    tags: string[];
    spanW: number;
    spanH: number;
  };
  children: Array<{
    id: string;
    name: string;
    description: string | null;
    color: string;
    tags: string[];
    photoUrl: string | null;
    stackIndex: number;
    createdAt: string;
    updatedAt: string;
  }>;
};

type Props = {
  furnitureId: string;
  canEdit: boolean;
  onClose: () => void;
  onEditFurniture: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onOpenChild: (childId: string) => void;
  /** Nudge the parent to refresh after a reorder. */
  onMutate: () => Promise<void> | void;
};

export default function FurnitureDetail({
  furnitureId,
  canEdit,
  onClose,
  onEditFurniture,
  onAddChild,
  onOpenChild,
  onMutate,
}: Props) {
  const [data, setData] = useState<FurnitureContents | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/boxes/${furnitureId}/contents`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erreur.");
        setLoading(false);
        return;
      }
      setData(json);
      setLoading(false);
    } catch {
      setError("Erreur réseau.");
      setLoading(false);
    }
  }, [furnitureId]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    load();
  }, [load, furnitureId]);

  async function reorder(childId: string, action: "up" | "down") {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/boxes/${furnitureId}/contents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, action }),
      });
      await load();
      await onMutate();
    } finally {
      setBusy(false);
    }
  }

  async function detachChild(childId: string) {
    if (!confirm("Sortir cette boîte du meuble ? Elle deviendra sans emplacement.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/boxes/${childId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: null }),
      });
      if (res.ok) {
        await load();
        await onMutate();
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="panel p-6 font-mono text-xs uppercase tracking-widest text-ink/50 text-center">
        Chargement…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="panel p-6 space-y-3">
        <p className="font-mono text-xs text-safety uppercase tracking-widest">
          {error ?? "Erreur."}
        </p>
        <button onClick={onClose} className="btn-ghost">
          Fermer
        </button>
      </div>
    );
  }

  const { parent, children } = data;

  return (
    <div className="panel overflow-hidden">
      {/* Header — furniture banner */}
      <div
        className="p-4 border-b-2 border-ink relative"
        style={{ backgroundColor: parent.color }}
      >
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(0,0,0,0.3) 0, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 12px)",
          }}
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper/80">
              Meuble · {parent.spanW} cellule{parent.spanW > 1 ? "s" : ""}
            </div>
            <h2 className="font-display text-2xl font-black text-paper break-words leading-tight mt-0.5">
              {parent.name}
            </h2>
            {parent.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {parent.tags.map((t) => (
                  <span
                    key={t}
                    className="font-mono text-[9px] uppercase tracking-widest bg-black/30 text-paper/90 px-1.5 py-0.5 border border-paper/30"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="font-mono text-xl text-paper/80 hover:text-paper shrink-0 leading-none"
            title="Fermer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="px-4 py-2 border-b border-dashed border-ink/20 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onEditFurniture(parent.id)}
            className="btn-ghost !text-[10px] !py-1"
          >
            ✎ Éditer
          </button>
          <button
            onClick={() => onAddChild(parent.id)}
            className="btn-primary !text-[10px] !py-1"
          >
            + Ajouter une boîte
          </button>
        </div>
      )}

      {/* Contents */}
      <div className="p-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60 mb-2">
          Contenu · {children.length} boîte{children.length > 1 ? "s" : ""}
        </div>
        {children.length === 0 ? (
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink/40 text-center py-6 border-2 border-dashed border-ink/20">
            Meuble vide
          </div>
        ) : (
          <ul className="space-y-1.5">
            {children.map((c, idx) => (
              <li
                key={c.id}
                className="flex items-center gap-2 p-2 border-2 border-ink shadow-stamp relative"
                style={{ backgroundColor: c.color }}
              >
                <span className="font-mono text-[9px] uppercase tracking-widest bg-paper/95 text-ink px-1.5 py-0.5 border border-ink shrink-0">
                  #{idx + 1}
                </span>
                <button
                  onClick={() => onOpenChild(c.id)}
                  className="font-display font-bold text-paper text-left flex-1 truncate hover:underline"
                  title="Voir la boîte"
                >
                  {c.name}
                </button>
                {c.tags.length > 0 && (
                  <span className="font-mono text-[9px] text-paper/80 truncate max-w-[30%] shrink-0">
                    {c.tags.slice(0, 2).map((t) => `#${t}`).join(" ")}
                    {c.tags.length > 2 && ` +${c.tags.length - 2}`}
                  </span>
                )}
                {canEdit && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => reorder(c.id, "up")}
                      disabled={busy || idx === 0}
                      className={clsx(
                        "w-6 h-6 grid place-items-center border border-paper/30 bg-black/20 text-paper hover:bg-black/40 font-mono text-xs",
                        (busy || idx === 0) && "opacity-30 cursor-not-allowed"
                      )}
                      title="Monter"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => reorder(c.id, "down")}
                      disabled={busy || idx === children.length - 1}
                      className={clsx(
                        "w-6 h-6 grid place-items-center border border-paper/30 bg-black/20 text-paper hover:bg-black/40 font-mono text-xs",
                        (busy || idx === children.length - 1) &&
                          "opacity-30 cursor-not-allowed"
                      )}
                      title="Descendre"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => detachChild(c.id)}
                      disabled={busy}
                      className="w-6 h-6 grid place-items-center border border-paper/30 bg-black/20 text-paper hover:bg-safety font-mono text-xs"
                      title="Sortir du meuble"
                    >
                      ⤴
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
