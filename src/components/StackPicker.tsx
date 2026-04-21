"use client";

import type { CellView } from "@/lib/types";

type Props = {
  cell: CellView;
  onPickBox: (boxId: string) => void;
  /** When undefined, the "add" button is hidden (read-only 3D view). */
  onAddBox?: () => void;
  onClose: () => void;
};

export default function StackPicker({
  cell,
  onPickBox,
  onAddBox,
  onClose,
}: Props) {
  const sorted = [...cell.boxes].reverse(); // top first
  const canAdd = cell.boxes.length < cell.capacity;

  return (
    <aside className="panel p-5 reveal space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60">
            Pile · {cell.code} {!onAddBox && "· lecture seule"}
          </div>
          <h3 className="font-display text-2xl font-black text-ink leading-tight">
            {cell.boxes.length} boîte{cell.boxes.length > 1 ? "s" : ""}
          </h3>
          <p className="font-mono text-[10px] text-ink/50 uppercase tracking-widest mt-1">
            Capacité {cell.boxes.length}/{cell.capacity}
          </p>
        </div>
        <button
          onClick={onClose}
          className="btn-ghost !px-2.5 !py-1.5"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      <ol className="space-y-1.5">
        {sorted.map((b, idx) => (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => onPickBox(b.id)}
              className="w-full flex items-center gap-3 p-2 border-2 border-ink shadow-stamp text-left transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-stamp-lg"
              style={{ backgroundColor: b.color }}
            >
              <span className="font-mono text-[10px] text-paper/80 w-8 text-center tracking-widest">
                {idx === 0 ? "TOP" : `#${b.stackIndex + 1}`}
              </span>
              <span className="font-display font-bold text-paper flex-1 truncate">
                {b.name}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {onAddBox && (
        <button
          disabled={!canAdd}
          onClick={onAddBox}
          className="btn-primary w-full"
        >
          {canAdd ? "+ Ajouter au-dessus" : "Pile pleine"}
        </button>
      )}
    </aside>
  );
}
