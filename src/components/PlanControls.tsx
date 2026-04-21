"use client";

import { useState } from "react";

type Props = {
  onAction: () => void;
  rowCount: number;
};

export default function PlanControls({ onAction, rowCount }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur.");
      } else {
        onAction();
      }
    } finally {
      setBusy(false);
    }
  }

  async function addRow() {
    const str = prompt("Combien de cellules sur cette nouvelle rangée ? (1-30)", "4");
    if (!str) return;
    const n = parseInt(str, 10);
    if (isNaN(n) || n < 1) return;
    await post({ action: "add_row", cells: n });
  }

  async function resetConfirm() {
    const rowsStr = prompt("Nombre de rangées (1-30) ?", "3");
    if (!rowsStr) return;
    const cellsStr = prompt("Nombre de cellules par rangée (1-30) ?", "4");
    if (!cellsStr) return;
    if (
      !confirm(
        "⚠️ Cette action supprime toutes les boîtes et remplace le plan. Continuer ?"
      )
    )
      return;
    await post({
      action: "reset",
      rows: parseInt(rowsStr, 10),
      cells: parseInt(cellsStr, 10),
    });
  }

  return (
    <div className="panel p-4 sm:p-5 space-y-4">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60">
          Mode édition du plan
        </div>
        <h3 className="font-display text-xl font-black text-ink leading-tight">
          Structure du box
        </h3>
        <p className="text-xs text-ink/70 mt-1 font-mono">
          Utilisez les boutons <span className="text-blueprint font-bold">+</span> au bout de chaque rangée pour allonger/raccourcir. Cliquez une cellule pour modifier son type et sa capacité.
        </p>
      </div>

      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mb-2">
          Rangées
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={busy}
            onClick={addRow}
            className="btn-primary !text-[10px]"
          >
            + Rangée
          </button>
          <RemoveRow rowCount={rowCount} onRemove={(r) => post({ action: "remove_row", row: r })} busy={busy} />
        </div>
      </div>

      <div className="pt-3 border-t-2 border-dashed border-ink/20">
        <button
          disabled={busy}
          onClick={resetConfirm}
          className="btn-safety !text-[10px] w-full"
        >
          ⚠ Réinitialiser tout le plan
        </button>
      </div>

      {error && (
        <div className="font-mono text-xs text-safety bg-safety/10 border-2 border-safety px-3 py-2">
          {error}
        </div>
      )}

      <div className="font-mono text-[10px] text-ink/50 uppercase tracking-widest pt-2 border-t border-dashed border-ink/20 space-y-1">
        <p>
          <span className="text-blueprint font-bold">+</span> à l'extrémité : allonge la rangée
        </p>
        <p>
          <span className="text-safety font-bold">−</span> sur une cellule : la retire (doit être vide)
        </p>
      </div>
    </div>
  );
}

function RemoveRow({
  rowCount,
  onRemove,
  busy,
}: {
  rowCount: number;
  onRemove: (r: number) => void;
  busy: boolean;
}) {
  const [row, setRow] = useState(1);
  if (rowCount === 0) {
    return (
      <button disabled className="btn-ghost !text-[10px]">
        Pas de rangée
      </button>
    );
  }
  return (
    <div className="flex gap-1">
      <select
        value={row}
        onChange={(e) => setRow(parseInt(e.target.value, 10))}
        className="input-field flex-1 !text-xs !px-1"
      >
        {Array.from({ length: rowCount }, (_, i) => i + 1).map((r) => (
          <option key={r} value={r}>
            R{r}
          </option>
        ))}
      </select>
      <button
        disabled={busy}
        onClick={() => onRemove(row)}
        className="btn-ghost !text-[10px] !px-2"
        title={`Retirer rangée R${row}`}
      >
        −
      </button>
    </div>
  );
}
