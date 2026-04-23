"use client";

import clsx from "clsx";
import {
  PLAN_PRESETS,
  EMPTY_PRESET_ID,
  DEFAULT_CELL_CAPACITY,
} from "@/lib/plan-presets";

type Props = {
  value: string;
  onChange: (presetId: string) => void;
};

export default function PlacePresetPicker({ value, onChange }: Props) {
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink mb-3 font-bold">
        Modèle de départ
      </div>
      <div className="space-y-2">
        {PLAN_PRESETS.map((p) => {
          const selected = value === p.id;
          const maxBoxes = p.rows * p.cols * DEFAULT_CELL_CAPACITY;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              className={clsx(
                "w-full text-left p-4 border-2 transition-all",
                "flex items-center gap-4",
                selected
                  ? "border-safety bg-safety/15 shadow-stamp ring-2 ring-safety"
                  : "border-ink bg-ink text-paper hover:bg-ink/90 hover:-translate-y-0.5 hover:shadow-stamp"
              )}
            >
              <span className="text-4xl shrink-0" aria-hidden>
                {p.icon}
              </span>
              <span className="flex-1 min-w-0 space-y-1">
                <span
                  className={clsx(
                    "font-display font-black text-base block",
                    selected ? "text-ink" : "text-paper"
                  )}
                >
                  {p.name}
                </span>
                <span
                  className={clsx(
                    "font-mono text-[10px] uppercase tracking-widest block font-bold",
                    selected ? "text-ink" : "text-paper"
                  )}
                >
                  {p.rows}×{p.cols} cellules &nbsp;·&nbsp; {p.approxSize} &nbsp;·&nbsp; jusqu'à {maxBoxes} boîtes
                </span>
                <span
                  className={clsx(
                    "text-xs block",
                    selected ? "text-ink/75" : "text-paper/80"
                  )}
                >
                  {p.description}
                </span>
              </span>
              {/* Mini preview grid */}
              <span
                className={clsx(
                  "shrink-0 grid gap-[2px] p-1 border-2",
                  selected ? "border-ink bg-paper/40" : "border-paper/40 bg-ink/50"
                )}
                style={{
                  gridTemplateColumns: `repeat(${p.cols}, 6px)`,
                  gridTemplateRows: `repeat(${p.rows}, 6px)`,
                }}
                aria-hidden
              >
                {Array.from({ length: p.rows * p.cols }).map((_, i) => (
                  <span
                    key={i}
                    className={clsx(
                      "block",
                      selected ? "bg-ink" : "bg-paper"
                    )}
                  />
                ))}
              </span>
            </button>
          );
        })}

        {/* Empty option */}
        <button
          type="button"
          onClick={() => onChange(EMPTY_PRESET_ID)}
          className={clsx(
            "w-full text-left p-4 border-2 border-dashed transition-all",
            "flex items-center gap-4",
            value === EMPTY_PRESET_ID
              ? "border-safety bg-safety/15 ring-2 ring-safety"
              : "border-ink/50 hover:border-ink text-ink hover:bg-paper-dark/30"
          )}
        >
          <span className="text-4xl shrink-0" aria-hidden>
            ⬜
          </span>
          <span className="flex-1 min-w-0 space-y-1">
            <span className="font-display font-black text-base block text-ink">
              Vide — je dessine moi-même
            </span>
            <span className="text-xs block text-ink/70">
              Partir d'un plan vide et ajouter mes cellules à la main
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
