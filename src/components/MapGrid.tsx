"use client";

import { useMemo, useState, type CSSProperties } from "react";
import clsx from "clsx";
import type { CellView, CellBoxLite, CellRenderRole, FlatEdgeItem } from "@/lib/types";
import { computeCellRoles } from "@/lib/types";

type Props = {
  cells: CellView[];
  flats?: FlatEdgeItem[];
  selectedCode?: string | null;
  highlightedCodes?: Set<string>;
  measureEndpoints?: { a?: string | null; b?: string | null };
  onCellClick?: (cell: CellView) => void;
  onFurnitureClick?: (furnitureId: string) => void;
  /** When true, the user is in "place a flat" mode: edges between cells
   *  become clickable (visual hover effect). Click triggers onEdgeClick. */
  placingFlat?: boolean;
  onEdgeClick?: (edge: { rowA: number; colA: number; rowB: number | null; colB: number | null }) => void;
  /** Click on an existing flat (by its id) — to open the edit form. */
  onFlatClick?: (flatId: string) => void;
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
 * v14 — Edge-based flats overlay.
 *
 * Flats no longer live inside cells. They live on the EDGE between two
 * adjacent cells (or between a cell and the outer space). We render an
 * absolutely-positioned overlay layer on top of the grid, with clickable
 * hotspots on each adjacency edge.
 */
export default function MapGrid({
  cells,
  flats = [],
  selectedCode,
  highlightedCodes,
  measureEndpoints,
  onCellClick,
  onFurnitureClick,
  placingFlat,
  onEdgeClick,
  onFlatClick,
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

          {/* Edge overlay: clickable hotspots + rendered flat lines */}
          <EdgeOverlay
            rowsList={rowsList}
            globalMinCol={globalMinCol}
            globalMaxCol={globalMaxCol}
            totalCols={totalCols}
            cellByCode={cellByCode}
            flats={flats}
            placingFlat={!!placingFlat}
            editMode={!!editMode}
            onEdgeClick={onEdgeClick}
            onFlatClick={onFlatClick}
          />
        </div>
      </div>
    </div>
  );
  // cellByCode is kept for future use (neighbor lookups etc.)
  void cellByCode;
}

// ─── Edge overlay (flats + click hotspots) ────────────────────────────
const CELL_PX = 80;     // 5rem at default font-size
const GAP_PX = 4;       // 0.25rem at default font-size
const EDGE_BTN_PX = 36; // 2.25rem (left/right edge button column)

function EdgeOverlay(props: {
  rowsList: Array<{ row: number; cells: CellView[] }>;
  globalMinCol: number;
  globalMaxCol: number;
  totalCols: number;
  cellByCode: Map<string, CellView>;
  flats: FlatEdgeItem[];
  placingFlat: boolean;
  editMode: boolean;
  onEdgeClick?: (edge: { rowA: number; colA: number; rowB: number | null; colB: number | null }) => void;
  onFlatClick?: (flatId: string) => void;
}) {
  const {
    rowsList, globalMinCol, totalCols, cellByCode,
    flats, placingFlat, editMode, onEdgeClick, onFlatClick,
  } = props;

  if (rowsList.length === 0) return null;

  // The overlay spans the full grid area, but excludes the left/right edge
  // button columns. We place it via gridColumn/gridRow on the grid itself.
  const overlayStyle: CSSProperties = {
    gridColumn: `2 / ${totalCols + 2}`, // column 1 is left buttons, last is right
    gridRow: `1 / ${rowsList.length + 1}`,
    position: "relative",
    pointerEvents: "none",
    zIndex: 5,
  };

  // Convert (row, col) to (x, y) center in px, RELATIVE to the overlay's
  // top-left (which is at the top-left of the cell grid area, after edge btns).
  const cellCenter = (row: number, col: number) => {
    const rowIdx = rowsList.findIndex((r) => r.row === row);
    const colIdx = col - globalMinCol;
    const x = colIdx * (CELL_PX + GAP_PX) + CELL_PX / 2;
    const y = rowIdx * (CELL_PX + GAP_PX) + CELL_PX / 2;
    return { x, y };
  };

  // Check if a cell exists at (row, col) in this place
  const cellAt = (row: number, col: number): CellView | null => {
    for (const cell of cellByCode.values()) {
      if (cell.row === row && cell.col === col) return cell;
    }
    return null;
  };

  // Build the list of all candidate edges in the plan: between each pair of
  // adjacent cells, plus outer edges (cell + null neighbor).
  type CandidateEdge = {
    rowA: number; colA: number;
    rowB: number | null; colB: number | null;
    orientation: "horizontal" | "vertical";
  };
  const candidates: CandidateEdge[] = [];
  for (const cell of cellByCode.values()) {
    // East edge (cell + east neighbor)
    const east = cellAt(cell.row, cell.col + 1);
    if (east) {
      // Only add once: keep the leftmost as A
      candidates.push({
        rowA: cell.row, colA: cell.col,
        rowB: east.row, colB: east.col,
        orientation: "vertical",
      });
    } else {
      // Outer edge on the east side
      candidates.push({
        rowA: cell.row, colA: cell.col,
        rowB: null, colB: null,
        orientation: "vertical",
      });
    }
    // South edge
    const south = cellAt(cell.row + 1, cell.col);
    if (south) {
      candidates.push({
        rowA: cell.row, colA: cell.col,
        rowB: south.row, colB: south.col,
        orientation: "horizontal",
      });
    } else {
      candidates.push({
        rowA: cell.row, colA: cell.col,
        rowB: null, colB: null,
        orientation: "horizontal",
      });
    }
  }
  // Also handle North-outer and West-outer for cells with no neighbor in those
  // directions (so flats can be placed against the outer wall).
  for (const cell of cellByCode.values()) {
    const north = cellAt(cell.row - 1, cell.col);
    if (!north) {
      candidates.push({
        rowA: cell.row, colA: cell.col,
        rowB: null, colB: null,
        orientation: "horizontal",
      });
    }
    const west = cellAt(cell.row, cell.col - 1);
    if (!west) {
      candidates.push({
        rowA: cell.row, colA: cell.col,
        rowB: null, colB: null,
        orientation: "vertical",
      });
    }
  }

  // Helper: get edge geometry (where to draw it)
  const edgeGeometry = (e: { rowA: number; colA: number; rowB: number | null; colB: number | null }) => {
    const a = cellCenter(e.rowA, e.colA);
    if (e.rowB !== null && e.colB !== null) {
      const b = cellCenter(e.rowB, e.colB);
      // Midpoint between the two cells
      const x = (a.x + b.x) / 2;
      const y = (a.y + b.y) / 2;
      // Orientation: horizontal if same column (different rows), vertical if same row
      const horizontal = e.rowA !== e.rowB;
      return { x, y, horizontal, isOuter: false };
    } else {
      // Outer edge: we don't have a clear orientation just from (A) — but the
      // candidate list separately encodes orientation. We'll compute outer
      // geometry differently per orientation in the render function below.
      return { x: a.x, y: a.y, horizontal: false, isOuter: true };
    }
  };

  // Map edge to its flats
  const edgeKey = (rowA: number, colA: number, rowB: number | null, colB: number | null, orientation?: string): string => {
    if (rowB === null || colB === null) {
      return `${rowA}-${colA}-OUT-${orientation ?? ""}`;
    }
    const a = `${rowA}-${colA}`;
    const b = `${rowB}-${colB}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  };
  const flatsByEdge = new Map<string, FlatEdgeItem[]>();
  for (const f of flats) {
    const k = edgeKey(f.rowA, f.colA, f.rowB, f.colB);
    const arr = flatsByEdge.get(k) ?? [];
    arr.push(f);
    flatsByEdge.set(k, arr);
  }

  return (
    <div style={overlayStyle}>
      {/* Hotspots: only when in placing mode */}
      {placingFlat && candidates.map((e, idx) => {
        const a = cellCenter(e.rowA, e.colA);
        const isHorizontal = e.orientation === "horizontal";
        // For outer edges, offset position to be "outside" the cell
        let x = a.x;
        let y = a.y;
        let width: number;
        let height: number;
        if (e.rowB !== null && e.colB !== null) {
          const b = cellCenter(e.rowB, e.colB);
          x = (a.x + b.x) / 2;
          y = (a.y + b.y) / 2;
          if (isHorizontal) {
            width = CELL_PX - 8;
            height = 12;
          } else {
            width = 12;
            height = CELL_PX - 8;
          }
        } else {
          // Outer edge: place along the cell's outer boundary
          // For outer horizontal: top or bottom; we don't know which, so
          // we render only the south outer edges (already in candidates) for now
          // — the north-only ones are added explicitly below.
          // Determine if it's north (above cell) or below: we use a heuristic
          // from the orientation list: horizontal candidates with rowB=null
          // can be either north or south. Let's treat them all as "south"
          // for cells whose south neighbor is missing, otherwise as north.
          // Actually: the candidate generation above already has duplicates
          // possible (south outer + north outer for top row). Let's just
          // detect from cellAt:
          if (isHorizontal) {
            // Check: does cell have a north neighbor?
            const north = cellAt(e.rowA - 1, e.colA);
            const south = cellAt(e.rowA + 1, e.colA);
            // If candidate was added from "no south" → south outer
            // If added from "no north" → north outer
            // We can't distinguish in this loop without state, so just place:
            //   - if no south → bottom of cell
            //   - if no north and we already placed south, place north
            // To keep it simple: place an outer edge only on the side where
            // there's no neighbor. If both missing, render two (already in
            // candidates).
            if (!south) {
              y = a.y + CELL_PX / 2;
            } else if (!north) {
              y = a.y - CELL_PX / 2;
            }
            width = CELL_PX - 8;
            height = 12;
          } else {
            const east = cellAt(e.rowA, e.colA + 1);
            const west = cellAt(e.rowA, e.colA - 1);
            if (!east) {
              x = a.x + CELL_PX / 2;
            } else if (!west) {
              x = a.x - CELL_PX / 2;
            }
            width = 12;
            height = CELL_PX - 8;
          }
        }
        return (
          <button
            key={`hot-${idx}-${e.rowA}-${e.colA}-${e.rowB}-${e.colB}-${e.orientation}`}
            type="button"
            onClick={(ev) => {
              ev.stopPropagation();
              onEdgeClick?.({
                rowA: e.rowA, colA: e.colA,
                rowB: e.rowB, colB: e.colB,
              });
            }}
            className="absolute pointer-events-auto bg-blueprint/0 hover:bg-blueprint/40 border border-blueprint/0 hover:border-blueprint transition-colors"
            style={{
              left: x - width / 2,
              top: y - height / 2,
              width,
              height,
              cursor: "pointer",
              borderRadius: 2,
            }}
            title="Cliquer pour poser un cadre ici"
          />
        );
      })}

      {/* Flats: drawn as colored bars on each edge */}
      {flats.map((f) => {
        const a = cellCenter(f.rowA, f.colA);
        const isOuter = f.rowB === null || f.colB === null;
        let isHorizontal: boolean;
        if (!isOuter) {
          // Same row → vertical bar; same col → horizontal bar
          isHorizontal = f.rowA !== f.rowB;
        } else {
          // For outer edges, we need to figure out orientation from neighbors.
          // Heuristic: if no cell to the east AND a is at colA = max col among
          // cells in its row → outer east → vertical. Etc.
          // Simpler: store the orientation in the edge candidate list keyed by
          // row/col. For now, use a heuristic: prefer horizontal (south) outer
          // unless the cell has no east/west neighbor.
          const east = cellAt(f.rowA, f.colA + 1);
          const west = cellAt(f.rowA, f.colA - 1);
          const north = cellAt(f.rowA - 1, f.colA);
          const south = cellAt(f.rowA + 1, f.colA);
          if (!east || !west) {
            isHorizontal = false; // vertical outer
          } else {
            isHorizontal = true; // horizontal outer
          }
        }

        // Compute bar position
        let x = a.x;
        let y = a.y;
        if (!isOuter && f.rowB !== null && f.colB !== null) {
          const b = cellCenter(f.rowB, f.colB);
          x = (a.x + b.x) / 2;
          y = (a.y + b.y) / 2;
        } else {
          // Outer: place at cell boundary
          if (isHorizontal) {
            const south = cellAt(f.rowA + 1, f.colA);
            if (!south) y = a.y + CELL_PX / 2;
            else y = a.y - CELL_PX / 2;
          } else {
            const east = cellAt(f.rowA, f.colA + 1);
            if (!east) x = a.x + CELL_PX / 2;
            else x = a.x - CELL_PX / 2;
          }
        }

        // Stack offset: multiple flats on the same edge are drawn parallel
        const stackOffset = f.stackIndex * 5;

        const barStyle: CSSProperties = isHorizontal
          ? {
              left: x - (CELL_PX - 16) / 2,
              top: y - 2 + stackOffset,
              width: CELL_PX - 16,
              height: 4,
            }
          : {
              left: x - 2 + stackOffset,
              top: y - (CELL_PX - 16) / 2,
              width: 4,
              height: CELL_PX - 16,
            };

        return (
          <button
            key={f.id}
            type="button"
            onClick={(ev) => {
              ev.stopPropagation();
              onFlatClick?.(f.id);
            }}
            className="absolute pointer-events-auto border border-black/40 hover:scale-y-150 hover:scale-x-150 transition-transform"
            style={{
              ...barStyle,
              backgroundColor: f.color || "#e8602c",
              boxShadow: "0 0 4px rgba(0,0,0,0.6)",
              borderRadius: 1,
              cursor: "pointer",
            }}
            title={`🖼 ${f.name}${f.isFragile ? " (fragile)" : ""}`}
          />
        );
      })}
    </div>
  );
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

  // ─── Normal cell (possibly stacked boxes + flats) ───
  // Mix boxes and flats in the same pile sorted by stackIndex.
  // - Boxes occupy full visual slots
  // ─── Normal cell (boxes only — flats now live as edges in the overlay) ───
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

  const canDragTop = dragEnabled && stackSize > 0;

  return (
    <button
      type="button"
      style={{
        ...placementStyle,
        backgroundColor: topBox ? topBox.color : undefined,
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
