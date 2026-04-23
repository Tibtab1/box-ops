"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { CellView, CellBoxLite, CellRenderRole } from "@/lib/types";
import { computeCellRoles } from "@/lib/types";

type Props = {
  cells: CellView[];
  selectedCode?: string | null;
  highlightedCodes?: Set<string>;
  measureEndpoints?: { a?: string | null; b?: string | null };
  onCellClick?: (cell: CellView) => void;
  onFurnitureClick?: (furnitureId: string) => void;
  placementMode?: boolean;
  editMode?: boolean;
  onRowMutate?: (
    row: number,
    action: "add_left" | "add_right" | "remove_left" | "remove_right"
  ) => Promise<void>;
  onBoxDrop?: (boxId: string, targetCode: string) => Promise<void>;
  onFurnitureDrop?: (furnitureId: string, targetCode: string) => Promise<void>;
  dragEnabled?: boolean;
};

/**
 * v13.5 — Unified single-grid rendering.
 *
 * Architecture change: instead of one CSS grid per row (which prevented
 * vertical furniture spans), we now place every cell in ONE big CSS grid.
 * Each cell specifies its `gridRow` and `gridColumn` explicitly based on
 * its (row, col) coordinates. Furniture anchors additionally use
 * `span N` to cover multiple grid tracks, cells covered by furniture
 * are simply not rendered.
 *
 * Row-edge buttons (add/remove cells) are rendered as a separate thin
 * column to the left and right of the main grid, with explicit row
 * placement to align with each data row.
 */
export default function MapGrid({
  cells,
  selectedCode,
  highlightedCodes,
  measureEndpoints,
  onCellClick,
  onFurnitureClick,
  placementMode,
  editMode,
  onRowMutate,
  onBoxDrop,
  onFurnitureDrop,
  dragEnabled,
}: Props) {
  const {
    rowsList,
    globalMinCol,
    globalMaxCol,
    totalCols,
    cellRoles,
    cellByCode,
  } = useMemo(() => {
    if (cells.length === 0) {
      return {
        rowsList: [] as Array<{ row: number; cells: CellView[] }>,
        globalMinCol: 0,
        globalMaxCol: 0,
        totalCols: 0,
        cellRoles: new Map<string, CellRenderRole>(),
        cellByCode: new Map<string, CellView>(),
      };
    }
    const byRow = new Map<number, CellView[]>();
    for (const c of cells) {
      const arr = byRow.get(c.row) ?? [];
      arr.push(c);
      byRow.set(c.row, arr);
    }
    const rowsList = [...byRow.entries()]
      .sort(([a], [b]) => a - b)
      .map(([row, arr]) => {
        arr.sort((a, b) => a.col - b.col);
        return { row, cells: arr };
      });
    const globalMinCol = Math.min(...cells.map((c) => c.col));
    const globalMaxCol = Math.max(...cells.map((c) => c.col));
    const totalCols = globalMaxCol - globalMinCol + 1;

    const boxesByCellId = new Map<string, CellBoxLite[]>();
    for (const c of cells) {
      boxesByCellId.set(c.id, c.boxes);
    }
    const cellRoles = computeCellRoles(cells, boxesByCellId);

    const cellByCode = new Map<string, CellView>();
    for (const c of cells) cellByCode.set(c.code, c);

    return {
      rowsList,
      globalMinCol,
      globalMaxCol,
      totalCols,
      cellRoles,
      cellByCode,
    };
  }, [cells]);

  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [dragged, setDragged] = useState<
    | { kind: "box"; id: string; fromCode: string }
    | { kind: "furniture"; id: string; fromCode: string }
    | null
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

  if (rowsList.length === 0) {
    return (
      <div className="panel p-10 text-center space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/40">
          Plan vide
        </div>
        <p className="font-display text-xl text-ink">
          Passez en mode édition pour dessiner votre box.
        </p>
      </div>
    );
  }

  // Map row number → row index (1-based for CSS grid)
  const rowIndexByRow = new Map<number, number>();
  rowsList.forEach(({ row }, idx) => {
    rowIndexByRow.set(row, idx + 1);
  });

  // Map col number → col index (1-based for CSS grid, after the left-edge column)
  // Grid layout: [edge-left] [col 0] [col 1] ... [col N-1] [edge-right]
  const colToGridCol = (col: number): number => col - globalMinCol + 2;

  // For each row we precompute its min/max col to know where edge buttons go
  const rowBounds = new Map<number, { minCol: number; maxCol: number }>();
  for (const { row, cells: rc } of rowsList) {
    rowBounds.set(row, {
      minCol: rc[0].col,
      maxCol: rc[rc.length - 1].col,
    });
  }

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <div
          className="grid mx-auto"
          style={{
            gridTemplateColumns: `2.25rem repeat(${totalCols}, 5rem) 2.25rem`,
            gridAutoRows: "5rem",
            gap: "0.25rem",
            width: "fit-content",
          }}
        >
          {/* Left edge buttons, one per row (only in editMode) */}
          {editMode &&
            rowsList.map(({ row }) => {
              const rIdx = rowIndexByRow.get(row)!;
              const rc = rowsList.find((r) => r.row === row)!.cells.length;
              const isBusy = busyRow === row;
              return (
                <div
                  key={`edge-l-${row}`}
                  style={{ gridColumn: 1, gridRow: rIdx }}
                  className={clsx(
                    "flex flex-col gap-1",
                    isBusy && "opacity-60 pointer-events-none"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => mutate(row, "add_left")}
                    title="Ajouter une cellule à gauche"
                    className="flex-1 w-full border-2 border-dashed border-ink/40 hover:border-ink hover:bg-paper-dark grid place-items-center font-mono text-sm text-ink/50 hover:text-ink"
                  >
                    +
                  </button>
                  {rc > 1 && (
                    <button
                      type="button"
                      onClick={() => mutate(row, "remove_left")}
                      title="Retirer la cellule de gauche"
                      className="w-full h-6 border-2 border-dashed border-safety/40 hover:border-safety hover:bg-safety/10 grid place-items-center font-mono text-[10px] text-safety/60 hover:text-safety"
                    >
                      −
                    </button>
                  )}
                </div>
              );
            })}

          {/* Right edge buttons */}
          {editMode &&
            rowsList.map(({ row }) => {
              const rIdx = rowIndexByRow.get(row)!;
              const rc = rowsList.find((r) => r.row === row)!.cells.length;
              const isBusy = busyRow === row;
              return (
                <div
                  key={`edge-r-${row}`}
                  style={{ gridColumn: totalCols + 2, gridRow: rIdx }}
                  className={clsx(
                    "flex flex-col gap-1",
                    isBusy && "opacity-60 pointer-events-none"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => mutate(row, "add_right")}
                    title="Ajouter une cellule à droite"
                    className="flex-1 w-full border-2 border-dashed border-ink/40 hover:border-ink hover:bg-paper-dark grid place-items-center font-mono text-sm text-ink/50 hover:text-ink"
                  >
                    +
                  </button>
                  {rc > 1 && (
                    <button
                      type="button"
                      onClick={() => mutate(row, "remove_right")}
                      title="Retirer la cellule de droite"
                      className="w-full h-6 border-2 border-dashed border-safety/40 hover:border-safety hover:bg-safety/10 grid place-items-center font-mono text-[10px] text-safety/60 hover:text-safety"
                    >
                      −
                    </button>
                  )}
                </div>
              );
            })}

          {/* All cells, each placed at its (row, col) explicitly.
              Cells covered by a furniture anchor are skipped — the anchor
              spans their area via grid-column/grid-row span. */}
          {cells
            .filter((cell) => {
              const r = cellRoles.get(cell.code) ?? { role: "normal" };
              return r.role !== "covered-by-furniture";
            })
            .map((cell) => {
              const role = cellRoles.get(cell.code) ?? { role: "normal" };
              const rIdx = rowIndexByRow.get(cell.row)!;
              const cIdx = colToGridCol(cell.col);
              return (
                <CellOrFurniture
                  key={cell.id}
                  cell={cell}
                  role={role}
                  gridRow={rIdx}
                  gridCol={cIdx}
                  dragged={dragged}
                  setDragged={setDragged}
                  dragOverCode={dragOverCode}
                  setDragOverCode={setDragOverCode}
                  dragEnabled={!!dragEnabled}
                  onBoxDrop={onBoxDrop}
                  onFurnitureDrop={onFurnitureDrop}
                  onCellClick={onCellClick}
                  onFurnitureClick={onFurnitureClick}
                  selectedCode={selectedCode}
                  highlightedCodes={highlightedCodes}
                  measureEndpoints={measureEndpoints}
                  placementMode={placementMode}
                  editMode={editMode}
                />
              );
            })}
        </div>
      </div>
    </div>
  );
  // cellByCode is kept for future use (neighbor lookups etc.)
  void cellByCode;
}

// ─── Cell or furniture block ──────────────────────────────────────────
function CellOrFurniture(props: {
  cell: CellView;
  role: CellRenderRole;
  gridRow: number;
  gridCol: number;
  dragged:
    | { kind: "box"; id: string; fromCode: string }
    | { kind: "furniture"; id: string; fromCode: string }
    | null;
  setDragged: (
    v:
      | { kind: "box"; id: string; fromCode: string }
      | { kind: "furniture"; id: string; fromCode: string }
      | null
  ) => void;
  dragOverCode: string | null;
  setDragOverCode: (v: string | null) => void;
  dragEnabled: boolean;
  onBoxDrop?: (boxId: string, targetCode: string) => Promise<void>;
  onFurnitureDrop?: (id: string, targetCode: string) => Promise<void>;
  onCellClick?: (cell: CellView) => void;
  onFurnitureClick?: (id: string) => void;
  selectedCode?: string | null;
  highlightedCodes?: Set<string>;
  measureEndpoints?: { a?: string | null; b?: string | null };
  placementMode?: boolean;
  editMode?: boolean;
}) {
  const {
    cell, role, gridRow, gridCol,
    dragged, setDragged, dragOverCode, setDragOverCode,
    dragEnabled, onBoxDrop, onFurnitureDrop, onCellClick, onFurnitureClick,
    selectedCode, highlightedCodes, measureEndpoints, placementMode, editMode,
  } = props;

  const isSelected = selectedCode === cell.code;
  const isHighlighted = highlightedCodes?.has(cell.code);
  const isMeasureA = measureEndpoints?.a === cell.code;
  const isMeasureB = measureEndpoints?.b === cell.code;

  // ─── Furniture anchor block ───
  if (role.role === "furniture-anchor") {
    const { spanW, spanH, boxId, name, color } = role;

    const isBeingDragged =
      dragged?.kind === "furniture" && dragged.id === boxId;
    const canDragFurniture = dragEnabled && !editMode && !placementMode;

    return (
      <div
        className="relative"
        style={{
          gridRow: `${gridRow} / span ${spanH}`,
          gridColumn: `${gridCol} / span ${spanW}`,
        }}
      >
        <button
          type="button"
          onClick={() => onFurnitureClick?.(boxId)}
          draggable={canDragFurniture}
          onDragStart={(e) => {
            if (!canDragFurniture) return;
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/boxops-furniture-id", boxId);
            setDragged({ kind: "furniture", id: boxId, fromCode: cell.code });
          }}
          onDragEnd={() => {
            setDragged(null);
            setDragOverCode(null);
          }}
          className={clsx(
            "w-full h-full border-[3px] border-ink shadow-stamp relative text-left",
            "transition-all hover:-translate-y-0.5 hover:shadow-stamp-lg",
            canDragFurniture && "cursor-grab active:cursor-grabbing",
            isBeingDragged && "opacity-40",
            isSelected && "ring-4 ring-safety ring-offset-2 ring-offset-paper",
            isHighlighted && "cell-highlight"
          )}
          style={{ backgroundColor: color }}
          aria-label={`Meuble ${name}`}
        >
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(0,0,0,0.25) 0, rgba(0,0,0,0.25) 1px, transparent 1px, transparent 12px)",
            }}
          />
          <span className="absolute top-1 left-1.5 font-mono text-[10px] tracking-wider text-paper/90">
            {cell.code}
          </span>
          <span className="absolute top-1 right-1 font-mono text-[9px] tracking-wider px-1 border border-paper/40 bg-black/30 text-paper/90">
            🪑 {spanW}×{spanH}
          </span>
          <span className="absolute inset-x-2 bottom-2 font-display font-black text-paper text-lg leading-tight line-clamp-3 drop-shadow">
            {name}
          </span>
        </button>
      </div>
    );
  }

  // Normal cell rendering — we wrap it in a placement div
  const placementStyle = {
    gridRow: gridRow,
    gridColumn: gridCol,
  };

  // ─── Aisle ───
  if (cell.type === "aisle") {
    return (
      <div
        style={placementStyle}
        className="border border-dashed border-ink/15 bg-transparent grid place-items-center"
      >
        <span className="font-mono text-[8px] uppercase tracking-widest text-ink/30">
          {cell.code}
        </span>
      </div>
    );
  }

  // ─── Wall ───
  if (cell.type === "wall") {
    return (
      <button
        type="button"
        style={placementStyle}
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
  }

  // ─── Normal cell (possibly stacked boxes) ───
  const boxStack = cell.boxes.filter((b) => b.kind === "box");
  const topBox = boxStack[boxStack.length - 1];
  const stackSize = boxStack.length;
  const occupied = stackSize > 0;
  const clickable = editMode || placementMode || !!onCellClick;

  const isBoxDropTarget =
    dragEnabled &&
    dragged?.kind === "box" &&
    dragged.fromCode !== cell.code &&
    stackSize < cell.capacity;
  const isFurnitureDropTarget =
    dragEnabled && dragged?.kind === "furniture";
  const isDropTarget = isBoxDropTarget || isFurnitureDropTarget;
  const isDragOverHere = isDropTarget && dragOverCode === cell.code;

  const canDragTop = dragEnabled && occupied;

  return (
    <button
      type="button"
      style={{
        ...placementStyle,
        backgroundColor: occupied && topBox ? topBox.color : undefined,
      }}
      disabled={!clickable && !isDropTarget}
      onClick={() => onCellClick?.(cell)}
      draggable={canDragTop}
      onDragStart={(e) => {
        if (!canDragTop || !topBox) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/boxops-box-id", topBox.id);
        setDragged({ kind: "box", id: topBox.id, fromCode: cell.code });
      }}
      onDragEnd={() => {
        setDragged(null);
        setDragOverCode(null);
      }}
      onDragOver={(e) => {
        if (!isDropTarget) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragOverCode !== cell.code) setDragOverCode(cell.code);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        if (dragOverCode === cell.code) setDragOverCode(null);
      }}
      onDrop={async (e) => {
        if (!isDropTarget) return;
        e.preventDefault();
        const boxId = e.dataTransfer.getData("text/boxops-box-id");
        const furnId = e.dataTransfer.getData("text/boxops-furniture-id");
        setDragged(null);
        setDragOverCode(null);
        if (boxId && onBoxDrop) {
          try { await onBoxDrop(boxId, cell.code); } catch {}
        } else if (furnId && onFurnitureDrop) {
          try { await onFurnitureDrop(furnId, cell.code); } catch {}
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
        canDragTop && "cursor-grab active:cursor-grabbing",
        dragged?.kind === "box" && dragged.fromCode === cell.code && "opacity-50",
        isDragOverHere && "ring-4 ring-blueprint scale-[1.03] z-10",
        !clickable && !isDropTarget && "cursor-default"
      )}
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

      {occupied && topBox && (
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
