"use client";

import type { CellView } from "@/lib/types";
import clsx from "clsx";

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
  // Show boxes and flats — exclude furniture (rendered separately as a wall block)
  const items = cell.boxes
    .filter((b) => b.kind === "box" || b.kind === "flat")
    .sort((a, b) => b.stackIndex - a.stackIndex); // top first
  const totalItems = items.length;
  const boxCount = items.filter((b) => b.kind === "box").length;
  const flatCount = items.filter((b) => b.kind === "flat").length;
  const canAdd = totalItems < cell.capacity;

  return (
    <aside className="panel p-5 reveal space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60">
            Pile · {cell.code} {!onAddBox && "· lecture seule"}
          </div>
          <h3 className="font-display text-2xl font-black text-ink leading-tight">
            {totalItems} {totalItems > 1 ? "éléments" : "élément"}
          </h3>
          <p className="font-mono text-[10px] text-ink/50 uppercase tracking-widest mt-1">
            {boxCount > 0 && `${boxCount} boîte${boxCount > 1 ? "s" : ""}`}
            {boxCount > 0 && flatCount > 0 && " · "}
            {flatCount > 0 && `${flatCount} cadre${flatCount > 1 ? "s" : ""}`}
            {" · "}capacité {totalItems}/{cell.capacity}
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
        {items.map((b, idx) => {
          const isFlat = b.kind === "flat";
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => onPickBox(b.id)}
                className={clsx(
                  "w-full flex items-center gap-3 text-left transition-all",
                  "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-stamp-lg",
                  isFlat
                    ? "p-1.5 border-2 border-ink border-dashed shadow-stamp"
                    : "p-2 border-2 border-ink shadow-stamp"
                )}
                style={{ backgroundColor: b.color }}
              >
                <span className="font-mono text-[10px] w-8 text-center tracking-widest shrink-0 text-paper/80">
                  {idx === 0 ? "TOP" : `#${b.stackIndex + 1}`}
                </span>
                <span className="text-base shrink-0" aria-hidden>
                  {isFlat
                    ? b.flatType === "painting"
                      ? "🎨"
                      : b.flatType === "photo"
                      ? "📷"
                      : b.flatType === "poster"
                      ? "📜"
                      : b.flatType === "mirror"
                      ? "🪞"
                      : "🖼"
                    : "📦"}
                </span>
                <span className="font-display font-bold text-paper flex-1 truncate">
                  {b.name}
                </span>
                {isFlat && b.isFragile && (
                  <span
                    className="font-mono text-[8px] uppercase tracking-widest text-paper bg-safety/80 px-1 py-0.5 border border-paper/40 shrink-0"
                    title="Fragile"
                  >
                    ⚠
                  </span>
                )}
              </button>
            </li>
          );
        })}
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
