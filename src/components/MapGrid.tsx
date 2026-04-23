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
  /** Called when a furniture block is clicked (to open its inner view). */
  onFurnitureClick?: (furnitureId: string) => void;
  placementMode?: boolean;
  editMode?: boolean;
  onRowMutate?: (
    row: number,
    action: "add_left" | "add_right" | "remove_left" | "remove_right"
  ) => Promise<void>;
  /** Called when a box is drag-dropped from one cell to another. */
  onBoxDrop?: (boxId: string, targetCode: string) => Promise<void>;
  /** Called when a furniture is drag-dropped. */
  onFurnitureDrop?: (furnitureId: string, targetCode: string) => Promise<void>;
  /** When true, boxes on top of stacks can be dragged. */
  dragEnabled?: boolean;
};

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
  // Group cells by row for aligned rendering
  const { rowsData, globalMinCol, globalMaxCol, cellRoles, cellByCode } =
    useMemo(() => {
      if (cells.length === 0) {
        return {
          rowsData: [],
          globalMinCol: 0,
          globalMaxCol: 0,
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

      // Build a map cellId -> boxes for computeCellRoles
      const boxesByCellId = new Map<string, CellBoxLite[]>();
      for (const c of cells) {
        boxesByCellId.set(c.id, c.boxes);
      }
      const cellRoles = computeCellRoles(cells, boxesByCellId);

      const cellByCode = new Map<string, CellView>();
      for (const c of cells) cellByCode.set(c.code, c);

      return { rowsData, globalMinCol, globalMaxCol, cellRoles, cellByCode };
    }, [cells]);

  const [busyRow, setBusyRow] = useState<number | null>(null);
  // Drag state
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

  if (rowsData.length === 0) {
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

  const totalCols = globalMaxCol - globalMinCol + 1;

  return (
    <div className="relative">
      <div className="space-y-2 overflow-x-auto">
        {rowsData.map(({ row, cells: rowCells, minCol, maxCol }) => {
          const leftPadding = minCol - globalMinCol;
          const rightPadding = globalMaxCol - maxCol;
          const isBusy = busyRow === row;

          return (
            <div
              key={row}
              className={clsx(
                "grid items-stretch gap-1",
                isBusy && "opacity-60 pointer-events-none"
              )}
              style={{
                gridTemplateColumns: `2.25rem repeat(${totalCols}, 5rem) 2.25rem`,
                gridAutoRows: "5rem",
              }}
            >
              {/* Left trim/add button */}
              {editMode && rowCells.length > 0 ? (
                <RowEdgeButtons
                  side="left"
                  onAdd={() => mutate(row, "add_left")}
                  onRemove={() => mutate(row, "remove_left")}
                  canRemove={rowCells.length > 1}
                />
              ) : (
                <div />
              )}

              {/* Left empty cells (alignment) */}
              {Array.from({ length: leftPadding }).map((_, i) => (
                <div key={`lpad-${i}`} />
              ))}

              {/* Actual cells — we filter out "covered-by-furniture" cells
                  entirely. Rendering them as empty divs would push the grid
                  indexing off by one and hide the last cell of the row. */}
              {rowCells
                .filter((cell) => {
                  const r = cellRoles.get(cell.code) ?? { role: "normal" };
                  return r.role !== "covered-by-furniture";
                })
                .map((cell) => {
                  const role = cellRoles.get(cell.code) ?? { role: "normal" };
                  return (
                    <CellOrFurniture
                      key={cell.id}
                      cell={cell}
                      role={role}
                      cellByCode={cellByCode}
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

              {/* Right padding */}
              {Array.from({ length: rightPadding }).map((_, i) => (
                <div key={`rpad-${i}`} />
              ))}

              {/* Right trim/add button */}
              {editMode && rowCells.length > 0 ? (
                <RowEdgeButtons
                  side="right"
                  onAdd={() => mutate(row, "add_right")}
                  onRemove={() => mutate(row, "remove_right")}
                  canRemove={rowCells.length > 1}
                />
              ) : (
                <div />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RowEdgeButtons({
  side,
  onAdd,
  onRemove,
  canRemove,
}: {
  side: "left" | "right";
  onAdd: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onAdd}
        title={`Ajouter une cellule ${side === "left" ? "à gauche" : "à droite"}`}
        className="flex-1 w-full border-2 border-dashed border-ink/40 hover:border-ink hover:bg-paper-dark grid place-items-center font-mono text-sm text-ink/50 hover:text-ink"
      >
        +
      </button>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          title={`Retirer la cellule ${side === "left" ? "de gauche" : "de droite"}`}
          className="w-full h-6 border-2 border-dashed border-safety/40 hover:border-safety hover:bg-safety/10 grid place-items-center font-mono text-[10px] text-safety/60 hover:text-safety"
        >
          −
        </button>
      )}
    </div>
  );
}

// ─── Cell or furniture block ──────────────────────────────────────────
function CellOrFurniture(props: {
  cell: CellView;
  role: CellRenderRole;
  cellByCode: Map<string, CellView>;
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
    cell, role, dragged, setDragged, dragOverCode, setDragOverCode,
    dragEnabled, onBoxDrop, onFurnitureDrop, onCellClick, onFurnitureClick,
    selectedCode, highlightedCodes, measureEndpoints, placementMode, editMode,
  } = props;

  // Covered cells are not rendered (the furniture anchor spans over them).
  if (role.role === "covered-by-furniture") {
    return <div aria-hidden className="pointer-events-none" />;
  }

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
          gridColumn: `span ${spanW}`,
          gridRow: `span ${spanH}`,
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
          {/* Wood-grain-like subtle diagonal lines */}
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
            🪑 ×{spanW}
          </span>
          <span className="absolute inset-x-2 bottom-2 font-display font-black text-paper text-lg leading-tight line-clamp-3 drop-shadow">
            {name}
          </span>
        </button>
      </div>
    );
  }

  // ─── Normal cell ───
  if (cell.type === "aisle") {
    return (
      <div className="border border-dashed border-ink/15 bg-transparent grid place-items-center">
        <span className="font-mono text-[8px] uppercase tracking-widest text-ink/30">
          {cell.code}
        </span>
      </div>
    );
  }

  if (cell.type === "wall") {
    return (
      <button
        type="button"
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

  // Cell: normal (possibly stacked boxes)
  const boxStack = cell.boxes.filter((b) => b.kind === "box");
  const topBox = boxStack[boxStack.length - 1];
  const stackSize = boxStack.length;
  const occupied = stackSize > 0;
  const clickable = editMode || placementMode || !!onCellClick;

  // Drop target logic:
  const isBoxDropTarget =
    dragEnabled &&
    dragged?.kind === "box" &&
    dragged.fromCode !== cell.code &&
    stackSize < cell.capacity;
  const isFurnitureDropTarget =
    dragEnabled && dragged?.kind === "furniture";
  const isDropTarget = isBoxDropTarget || isFurnitureDropTarget;
  const isDragOverHere = isDropTarget && dragOverCode === cell.code;

  // Can top box be dragged from this cell?
  const canDragTop = dragEnabled && occupied;

  return (
    <button
      type="button"
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
      style={occupied && topBox ? { backgroundColor: topBox.color } : undefined}
      aria-label={
        occupied && topBox
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
