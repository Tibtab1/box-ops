"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { CellView } from "@/lib/types";

type Props = {
  cells: CellView[];
  onBoxClick: (boxId: string) => void;
  onClose: () => void;
};

export default function CrossSection({ cells, onBoxClick, onClose }: Props) {
  const rows = useMemo(() => {
    const set = new Set(
      cells.filter((c) => c.type === "cell" && c.enabled).map((c) => c.row)
    );
    return [...set].sort((a, b) => a - b);
  }, [cells]);

  const [selectedRow, setSelectedRow] = useState<number>(rows[0] ?? 0);

  // Keep selectedRow in sync if rows change (e.g. after plan edit)
  useEffect(() => {
    if (rows.length > 0 && !rows.includes(selectedRow)) {
      setSelectedRow(rows[0]);
    }
  }, [rows, selectedRow]);

  const rowCells = useMemo(
    () =>
      cells
        .filter(
          (c) => c.type === "cell" && c.enabled && c.row === selectedRow
        )
        .sort((a, b) => a.col - b.col),
    [cells, selectedRow]
  );

  const maxStack = useMemo(
    () => Math.max(1, ...rowCells.map((c) => c.boxes.length)),
    [rowCells]
  );

  const BOX_H = 36;
  const COL_W = 84;

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60">
            Vue frontale
          </div>
          <h3 className="font-display font-bold text-lg text-ink leading-tight">
            Coupe — Rangée {selectedRow + 1}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Row selector */}
          <div className="flex gap-1 flex-wrap">
            {rows.map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRow(r)}
                className={clsx(
                  "font-mono text-[10px] uppercase tracking-widest w-7 h-7 border-2 transition-all",
                  selectedRow === r
                    ? "bg-ink text-paper border-ink"
                    : "border-ink/30 text-ink/70 hover:border-ink"
                )}
              >
                {r + 1}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="btn-ghost !px-2.5 !py-1.5 shrink-0"
            aria-label="Fermer la coupe"
          >
            ✕
          </button>
        </div>
      </div>

      {rowCells.length === 0 ? (
        <div className="font-mono text-xs uppercase tracking-widest text-ink/40 text-center py-8">
          Aucune cellule active dans cette rangée.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="flex gap-1.5 items-end"
            style={{ minWidth: rowCells.length * (COL_W + 6) }}
          >
            {rowCells.map((cell) => (
              <div key={cell.id} className="flex flex-col items-stretch gap-1" style={{ width: COL_W }}>
                {/* Stack zone — grows from bottom */}
                <div
                  className="flex flex-col-reverse gap-0.5"
                  style={{ minHeight: maxStack * (BOX_H + 2) }}
                >
                  {cell.boxes.length === 0 ? (
                    <div
                      className="w-full border-2 border-dashed border-ink/20 grid place-items-center"
                      style={{ height: BOX_H }}
                    >
                      <span className="font-mono text-[9px] text-ink/30 uppercase tracking-widest">
                        vide
                      </span>
                    </div>
                  ) : (
                    cell.boxes.map((box) => (
                      <button
                        key={box.id}
                        type="button"
                        onClick={() => onBoxClick(box.id)}
                        className="w-full border-2 border-ink shadow-stamp hover:-translate-y-0.5 hover:shadow-stamp-lg transition-all overflow-hidden px-1 flex items-center justify-center"
                        style={{ backgroundColor: box.color, height: BOX_H }}
                        title={box.name}
                      >
                        <span className="font-display font-bold text-paper text-[10px] truncate text-center leading-tight">
                          {box.name}
                        </span>
                      </button>
                    ))
                  )}
                </div>

                {/* Cell label */}
                <div className="border-t-2 border-ink pt-1 text-center">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-ink font-bold">
                    {cell.code}
                  </div>
                  <div className="font-mono text-[8px] text-ink/40">
                    {cell.boxes.length}/{cell.capacity}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="font-mono text-[9px] uppercase tracking-widest text-ink/30 text-center">
        Vue de face · cliquez une boîte pour l'ouvrir
      </p>
    </div>
  );
}
