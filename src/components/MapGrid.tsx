"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { CellView } from "@/lib/types";

type Props = {
  cells: CellView[];
  selectedCode?: string | null;
  highlightedCodes?: Set<string>;
  measureEndpoints?: { a?: string | null; b?: string | null };
  onCellClick?: (cell: CellView) => void;
  placementMode?: boolean;
  editMode?: boolean;
  /** Called when + / − button at a row extremity is pressed */
  onRowMutate?: (
    row: number,
    action: "add_left" | "add_right" | "remove_left" | "remove_right"
  ) => Promise<void>;
  /** Called when a box is drag-dropped from one cell to another (editor+). */
  onBoxDrop?: (boxId: string, targetCode: string) => Promise<void>;
  /** When true, boxes on top of stacks can be dragged. */
  dragEnabled?: boolean;
};

export default function MapGrid({
  cells,
  selectedCode,
  highlightedCodes,
  measureEndpoints,
  onCellClick,
  placementMode,
  editMode,
  onRowMutate,
  onBoxDrop,
  dragEnabled,
}: Props) {
  // Group cells by row. Each row knows its min/max column for alignment.
  const { rowsData, globalMinCol, globalMaxCol } = useMemo(() => {
    if (cells.length === 0) {
      return { rowsData: [], globalMinCol: 0, globalMaxCol: 0 };
    }
    const byRow = new Map<number, CellView[]>();
    for (const c of cells) {
      const arr = byRow.get(c.row) ?? [];
      arr.push(c);
      byRow.set(c.row, arr);
    }
    const rowsData = [...byRow.entries()]
      .sort(([a], [b]) => a - b)
      .map(([row, arr]) => {
        arr.sort((a, b) => a.col - b.col);
        return {
          row,
          cells: arr,
          minCol: arr[0].col,
          maxCol: arr[arr.length - 1].col,
        };
      });
    const globalMinCol = Math.min(...rowsData.map((r) => r.minCol));
    const globalMaxCol = Math.max(...rowsData.map((r) => r.maxCol));
    return { rowsData, globalMinCol, globalMaxCol };
  }, [cells]);

  const [busyRow, setBusyRow] = useState<number | null>(null);
  // ── Drag & drop state ──────────────────────────────────────────────
  // draggedBox: the box currently being dragged (null when idle)
  // dragOverCode: cell code under pointer, for visual highlight
  const [draggedBox, setDraggedBox] = useState<
    { id: string; fromCode: string } | null
  >(null);
  const [dragOverCode, setDragOverCode] = useState<string | null>(null);

  async function mutate(
    row: number,
    action: "add_left" | "add_right" | "remove_left" | "remove_right"
  ) {
    if (!onRowMutate) return;
    setBusyRow(row);
    try {
      await onRowMutate(row, action);
    } finally {
      setBusyRow(null);
    }
  }

  if (cells.length === 0) {
    return (
      <div className="panel p-10 text-center">
        <div className="font-mono text-xs uppercase tracking-widest text-ink/60">
          Plan vide
        </div>
        <p className="font-display text-xl text-ink mt-2">
          Passez en mode édition pour dessiner votre box.
        </p>
      </div>
    );
  }

  // In edit mode we widen the virtual grid by 1 on each side to make room for
  // the + buttons that live just outside the actual row.
  const displayMinCol = editMode ? globalMinCol - 1 : globalMinCol;
  const displayMaxCol = editMode ? globalMaxCol + 1 : globalMaxCol;
  const totalCols = displayMaxCol - displayMinCol + 1;
  const rowCount = rowsData.length;

  return (
    <div className="panel p-4 sm:p-6 overflow-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5 pb-3 border-b-2 border-dashed border-ink/40">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60">
            Plan · {rowCount} rangée{rowCount > 1 ? "s" : ""} · {cells.length} cellule{cells.length > 1 ? "s" : ""}
            {editMode && " · mode édition"}
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-black text-ink leading-none mt-1">
            Box n°1
          </h2>
        </div>
        <Legend editMode={editMode} />
      </div>

      <div className="space-y-1.5">
        {rowsData.map(({ row, cells: rowCells, minCol, maxCol }) => {
          const leftButtonCol = minCol - 1;
          const rightButtonCol = maxCol + 1;
          return (
            <div
              key={row}
              className="grid gap-1.5 items-center"
              style={{
                gridTemplateColumns: `2.5rem repeat(${totalCols}, minmax(3.5rem, 1fr))`,
              }}
            >
              {/* Row label on the left */}
              <div className="font-mono text-[11px] tracking-widest text-ink/60 text-right pr-1 flex items-center justify-end gap-1">
                <span>R{row}</span>
                {editMode && (
                  <span className="font-normal text-ink/40 text-[9px]">
                    ({rowCells.length})
                  </span>
                )}
              </div>

              {/* Render each column slot from displayMinCol to displayMaxCol */}
              {Array.from({ length: totalCols }, (_, idx) => {
                const col = displayMinCol + idx;

                // Is there a cell at this exact (row, col)?
                const cell = rowCells.find((c) => c.col === col);

                // Edit-mode + buttons at extremities (outside cells)
                if (editMode && !cell && col === leftButtonCol) {
                  return (
                    <div key={idx} className="aspect-square">
                      <button
                        disabled={busyRow === row}
                        onClick={() => mutate(row, "add_left")}
                        className="w-full h-full border-2 border-dashed border-blueprint/60 text-blueprint font-mono text-lg leading-none grid place-items-center hover:bg-blueprint hover:text-paper transition-colors"
                        aria-label={`Ajouter à gauche de la rangée ${row}`}
                        title="Ajouter à gauche"
                      >
                        +
                      </button>
                    </div>
                  );
                }
                if (editMode && !cell && col === rightButtonCol) {
                  return (
                    <div key={idx} className="aspect-square">
                      <button
                        disabled={busyRow === row}
                        onClick={() => mutate(row, "add_right")}
                        className="w-full h-full border-2 border-dashed border-blueprint/60 text-blueprint font-mono text-lg leading-none grid place-items-center hover:bg-blueprint hover:text-paper transition-colors"
                        aria-label={`Ajouter à droite de la rangée ${row}`}
                        title="Ajouter à droite"
                      >
                        +
                      </button>
                    </div>
                  );
                }

                if (!cell) {
                  // Empty column slot (this row doesn't extend here)
                  return <div key={idx} className="aspect-square" />;
                }

                return (
                  <CellButton
                    key={cell.id}
                    cell={cell}
                    isFirst={cell.col === minCol}
                    isLast={cell.col === maxCol}
                    rowCellCount={rowCells.length}
                    busyRow={busyRow === row}
                    onCellClick={onCellClick}
                    onMutate={(a) => mutate(row, a)}
                    editMode={editMode}
                    placementMode={placementMode}
                    selectedCode={selectedCode}
                    highlightedCodes={highlightedCodes}
                    measureEndpoints={measureEndpoints}
                    dragEnabled={dragEnabled}
                    draggedBox={draggedBox}
                    setDraggedBox={setDraggedBox}
                    dragOverCode={dragOverCode}
                    setDragOverCode={setDragOverCode}
                    onBoxDrop={onBoxDrop}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CellButton({
  cell,
  isFirst,
  isLast,
  rowCellCount,
  busyRow,
  onCellClick,
  onMutate,
  editMode,
  placementMode,
  selectedCode,
  highlightedCodes,
  measureEndpoints,
  dragEnabled,
  draggedBox,
  setDraggedBox,
  dragOverCode,
  setDragOverCode,
  onBoxDrop,
}: {
  cell: CellView;
  isFirst: boolean;
  isLast: boolean;
  rowCellCount: number;
  busyRow: boolean;
  onCellClick?: (cell: CellView) => void;
  onMutate: (action: "remove_left" | "remove_right") => void;
  editMode?: boolean;
  placementMode?: boolean;
  selectedCode?: string | null;
  highlightedCodes?: Set<string>;
  measureEndpoints?: { a?: string | null; b?: string | null };
  dragEnabled?: boolean;
  draggedBox: { id: string; fromCode: string } | null;
  setDraggedBox: (v: { id: string; fromCode: string } | null) => void;
  dragOverCode: string | null;
  setDragOverCode: (v: string | null) => void;
  onBoxDrop?: (boxId: string, targetCode: string) => Promise<void>;
}) {
  const topBox = cell.boxes[cell.boxes.length - 1];
  const stackSize = cell.boxes.length;
  const isSelected = selectedCode === cell.code;
  const isHighlighted = highlightedCodes?.has(cell.code);
  const isMeasureA = measureEndpoints?.a === cell.code;
  const isMeasureB = measureEndpoints?.b === cell.code;

  const clickable = editMode || placementMode || !!onCellClick;

  // In edit mode, show a small − trim button on the first and last cells
  // (only when the row has more than one cell and the cell is empty).
  const canRemoveFirst =
    editMode && isFirst && rowCellCount > 1 && stackSize === 0;
  const canRemoveLast =
    editMode && isLast && rowCellCount > 1 && stackSize === 0;

  let content: React.ReactNode = null;

  if (cell.type === "aisle") {
    content = (
      <button
        type="button"
        disabled={!editMode}
        onClick={() => onCellClick?.(cell)}
        className={clsx(
          "w-full h-full aisle-hatch border border-ink/30 relative",
          editMode && "hover:border-ink hover:border-2 cursor-pointer"
        )}
        title="Allée"
      >
        {editMode && (
          <span className="absolute inset-0 grid place-items-center font-mono text-[9px] uppercase tracking-wider text-ink/70 bg-paper/40">
            allée
          </span>
        )}
      </button>
    );
  } else if (!cell.enabled) {
    content = (
      <button
        type="button"
        disabled={!editMode}
        onClick={() => onCellClick?.(cell)}
        className={clsx(
          "w-full h-full border border-ink/20 bg-ink/10 relative grid place-items-center",
          editMode && "hover:border-ink cursor-pointer"
        )}
      >
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink/40">
          ✕ {cell.code}
        </span>
      </button>
    );
  } else {
    const occupied = stackSize > 0;
    const isDropTarget =
      dragEnabled && draggedBox !== null && draggedBox.fromCode !== cell.code;
    const isDragOverHere = isDropTarget && dragOverCode === cell.code;
    // Only the top box can be dragged (and only in editor mode via dragEnabled)
    const canDragTop = dragEnabled && occupied;

    content = (
      <button
        type="button"
        disabled={!clickable && !isDropTarget}
        onClick={() => onCellClick?.(cell)}
        draggable={canDragTop}
        onDragStart={(e) => {
          if (!canDragTop) return;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/boxops-box-id", topBox.id);
          setDraggedBox({ id: topBox.id, fromCode: cell.code });
        }}
        onDragEnd={() => {
          setDraggedBox(null);
          setDragOverCode(null);
        }}
        onDragOver={(e) => {
          if (!isDropTarget) return;
          // Only accept if target cell has capacity
          if (stackSize >= cell.capacity) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (dragOverCode !== cell.code) setDragOverCode(cell.code);
        }}
        onDragLeave={(e) => {
          // avoid flicker when moving between children
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          if (dragOverCode === cell.code) setDragOverCode(null);
        }}
        onDrop={async (e) => {
          if (!isDropTarget || !onBoxDrop) return;
          e.preventDefault();
          const boxId = e.dataTransfer.getData("text/boxops-box-id");
          setDraggedBox(null);
          setDragOverCode(null);
          if (boxId) {
            try {
              await onBoxDrop(boxId, cell.code);
            } catch {
              // errors bubble through parent toast/state
            }
          }
        }}
        className={clsx(
          "relative w-full h-full border-2 transition-all text-left",
          occupied
            ? "border-ink shadow-stamp hover:-translate-y-0.5 hover:shadow-stamp-lg"
            : "border-dashed border-ink/40 bg-paper hover:border-ink hover:bg-paper-dark",
          isSelected && "ring-4 ring-safety ring-offset-2 ring-offset-paper",
          isHighlighted && "cell-highlight",
          (isMeasureA || isMeasureB) &&
            "ring-4 ring-blueprint ring-offset-2 ring-offset-paper",
          placementMode && !occupied &&
            "bg-blueprint-pale/60 hover:bg-blueprint-light/50",
          editMode && "ring-2 ring-blueprint/30",
          // Drag-related visuals
          canDragTop && "cursor-grab active:cursor-grabbing",
          draggedBox?.fromCode === cell.code && "opacity-50",
          isDragOverHere && "ring-4 ring-blueprint scale-[1.03] z-10",
          !clickable && !isDropTarget && "cursor-default"
        )}
        style={occupied ? { backgroundColor: topBox.color } : undefined}
        aria-label={
          occupied
            ? `${cell.code} — ${topBox.name} (${stackSize})`
            : `${cell.code} — vide`
        }
      >
        <span
          className={clsx(
            "absolute top-1 left-1.5 font-mono text-[10px] tracking-wider",
            occupied ? "text-paper/90" : "text-ink/50"
          )}
        >
          {cell.code}
        </span>

        {(editMode || stackSize > 1) && (
          <span
            className={clsx(
              "absolute top-1 right-1 font-mono text-[9px] tracking-wider px-1 border",
              occupied
                ? "text-paper/90 border-paper/40 bg-black/20"
                : "text-ink/50 border-ink/30 bg-paper"
            )}
          >
            {stackSize}/{cell.capacity}
          </span>
        )}

        {occupied && (
          <span className="absolute inset-x-1 bottom-1 font-mono text-[10px] font-bold uppercase tracking-wider text-paper/95 line-clamp-2 leading-tight">
            {topBox.name}
          </span>
        )}

        {stackSize > 1 && (
          <span className="absolute -top-2 -left-2 min-w-[1.5rem] h-6 px-1.5 rounded-full bg-ink text-paper font-mono text-[10px] font-bold grid place-items-center border-2 border-paper shadow-stamp">
            ×{stackSize}
          </span>
        )}

        {isMeasureA && (
          <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blueprint text-paper font-mono text-[10px] font-bold grid place-items-center border-2 border-paper shadow-stamp">
            A
          </span>
        )}
        {isMeasureB && (
          <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blueprint text-paper font-mono text-[10px] font-bold grid place-items-center border-2 border-paper shadow-stamp">
            B
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="relative aspect-square">
      {content}
      {canRemoveFirst && (
        <button
          type="button"
          disabled={busyRow}
          onClick={(e) => {
            e.stopPropagation();
            onMutate("remove_left");
          }}
          className="absolute -top-2 -left-2 z-10 w-5 h-5 rounded-full bg-safety text-paper font-mono text-[11px] font-bold grid place-items-center border-2 border-paper shadow-stamp hover:scale-110 transition-transform"
          title="Retirer cette cellule (extrémité gauche)"
          aria-label="Retirer la cellule de gauche"
        >
          −
        </button>
      )}
      {canRemoveLast && (
        <button
          type="button"
          disabled={busyRow}
          onClick={(e) => {
            e.stopPropagation();
            onMutate("remove_right");
          }}
          className="absolute -bottom-2 -right-2 z-10 w-5 h-5 rounded-full bg-safety text-paper font-mono text-[11px] font-bold grid place-items-center border-2 border-paper shadow-stamp hover:scale-110 transition-transform"
          title="Retirer cette cellule (extrémité droite)"
          aria-label="Retirer la cellule de droite"
        >
          −
        </button>
      )}
    </div>
  );
}

function Legend({ editMode }: { editMode?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-mono uppercase tracking-[0.15em] text-ink/70">
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 bg-safety border border-ink" />
        occupé
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 bg-paper border-2 border-dashed border-ink/50" />
        libre
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 aisle-hatch border border-ink/30" />
        allée
      </span>
      {editMode && (
        <>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-ink/10 border border-ink/30" />
            désactivé
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 grid place-items-center border-2 border-dashed border-blueprint/60 text-blueprint text-[10px] leading-none">
              +
            </span>
            étendre
          </span>
        </>
      )}
    </div>
  );
}
