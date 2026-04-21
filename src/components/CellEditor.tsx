"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import type { CellView } from "@/lib/types";

type Props = {
  cell: CellView;
  onUpdated: () => void;
  onClose: () => void;
};

export default function CellEditor({ cell, onUpdated, onClose }: Props) {
  const [type, setType] = useState(cell.type);
  const [capacity, setCapacity] = useState(cell.capacity);
  const [enabled, setEnabled] = useState(cell.enabled);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setType(cell.type);
    setCapacity(cell.capacity);
    setEnabled(cell.enabled);
    setError(null);
  }, [cell]);

  async function saveCell() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/locations/${cell.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, capacity, enabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur.");
        setBusy(false);
        return;
      }
      onUpdated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="panel p-5 reveal space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60">
            Édition de cellule
          </div>
          <h3 className="font-display text-2xl font-black text-ink leading-tight">
            {cell.code}
          </h3>
          <p className="font-mono text-[10px] text-ink/50 uppercase tracking-widest mt-1">
            Rangée {cell.row} · Position {cell.col + 1}
          </p>
        </div>
        <button onClick={onClose} className="btn-ghost !px-2.5 !py-1.5" aria-label="Fermer">
          ✕
        </button>
      </div>

      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 mb-2">
          Type
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(["cell", "aisle", "wall"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={clsx(
                "font-mono text-[10px] uppercase tracking-widest px-2 py-2 border-2 transition-all",
                type === t
                  ? "bg-ink text-paper border-ink shadow-stamp"
                  : "border-ink/30 text-ink/70 hover:border-ink"
              )}
            >
              {t === "cell" ? "Emplacement" : t === "aisle" ? "Allée" : "Mur"}
            </button>
          ))}
        </div>
      </div>

      {type === "cell" && (
        <>
          <div>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 block mb-1.5">
                Capacité de la pile (max)
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={capacity}
                  onChange={(e) =>
                    setCapacity(parseInt(e.target.value, 10) || 1)
                  }
                  className="input-field w-20 text-center"
                />
                <span className="font-mono text-[11px] text-ink/60">
                  boîtes max · {cell.boxes.length} placée(s)
                </span>
              </div>
            </label>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 accent-safety"
            />
            <span className="font-mono text-xs uppercase tracking-widest text-ink/80">
              Emplacement actif
            </span>
          </label>
        </>
      )}

      <button
        disabled={busy}
        onClick={saveCell}
        className="btn-primary w-full"
      >
        {busy ? "…" : "Enregistrer la cellule"}
      </button>

      {error && (
        <div className="font-mono text-xs text-safety bg-safety/10 border-2 border-safety px-3 py-2">
          {error}
        </div>
      )}
    </aside>
  );
}
