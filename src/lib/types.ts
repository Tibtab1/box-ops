// Shared types — v13 with furniture support.

export type LocationDTO = {
  id: string;
  code: string;
  aisle: string;
  slot: number;
  row: number;
  col: number;
  type: "cell" | "aisle" | "wall";
  capacity: number;
  enabled: boolean;
};

export type BoxDTO = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  photoUrl: string | null;
  color: string;
  locationId: string | null;
  stackIndex: number;
  location: LocationDTO | null;
  kind: "box" | "furniture";
  spanW: number;
  spanH: number;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CellBoxLite = {
  id: string;
  name: string;
  color: string;
  tags: string[];
  stackIndex: number;
  kind: "box" | "furniture";
  spanW: number;
  spanH: number;
};

export type CellView = LocationDTO & {
  // All boxes/furniture placed on this cell (where this cell is the anchor for furniture).
  // Ordered bottom → top for stacking boxes. Furniture always has stackIndex=0.
  boxes: CellBoxLite[];
};

/** Manhattan distance, still based on grid cells. */
export function gridDistance(
  a: Pick<LocationDTO, "row" | "col">,
  b: Pick<LocationDTO, "row" | "col">
): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function serializeTags(tags: string[]): string {
  return tags
    .map((t) => t.trim())
    .filter(Boolean)
    .join(",");
}

/** Convert a 0-based column index to a letter sequence: 0→A, 25→Z, 26→AA. */
export function colToLetter(col: number): string {
  let s = "";
  let n = col;
  while (true) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return s;
}

/**
 * For a given set of cells, figure out which cells are the ANCHORS of furniture
 * items and which cells are "covered" (masked) by furniture sitting on a
 * neighboring anchor. Returns a map from cellCode → "normal" | "furniture-anchor"
 * | "covered-by-furniture" with extra metadata about the covering furniture.
 *
 * This lets the MapGrid know how to render each cell: anchors get a merged
 * visual block spanning spanW × spanH cells, and covered cells are not shown
 * (the block sits on top).
 */
export type CellRenderRole =
  | { role: "normal" }
  | {
      role: "furniture-anchor";
      boxId: string;
      name: string;
      color: string;
      spanW: number;
      spanH: number;
    }
  | {
      role: "covered-by-furniture";
      anchorCode: string; // Code of the cell that hosts the furniture anchor
    };

export function computeCellRoles(
  cells: Array<{ id: string; code: string; row: number; col: number }>,
  boxesByCellId: Map<string, CellBoxLite[]>
): Map<string, CellRenderRole> {
  const result = new Map<string, CellRenderRole>();
  // Find furniture anchors
  type FurnitureInfo = {
    boxId: string;
    name: string;
    color: string;
    anchorCode: string;
    anchorRow: number;
    anchorCol: number;
    spanW: number;
    spanH: number;
  };
  const furnitureList: FurnitureInfo[] = [];

  for (const cell of cells) {
    const cellBoxes = boxesByCellId.get(cell.id) ?? [];
    const furniture = cellBoxes.find((b) => b.kind === "furniture");
    if (furniture) {
      furnitureList.push({
        boxId: furniture.id,
        name: furniture.name,
        color: furniture.color,
        anchorCode: cell.code,
        anchorRow: cell.row,
        anchorCol: cell.col,
        spanW: furniture.spanW,
        spanH: furniture.spanH,
      });
      result.set(cell.code, {
        role: "furniture-anchor",
        boxId: furniture.id,
        name: furniture.name,
        color: furniture.color,
        spanW: furniture.spanW,
        spanH: furniture.spanH,
      });
    }
  }

  // Map from (row, col) to cell code for fast lookup
  const codeByCoord = new Map<string, string>();
  for (const cell of cells) {
    codeByCoord.set(`${cell.row},${cell.col}`, cell.code);
  }

  // Mark covered cells
  for (const f of furnitureList) {
    for (let dr = 0; dr < f.spanH; dr++) {
      for (let dc = 0; dc < f.spanW; dc++) {
        if (dr === 0 && dc === 0) continue; // anchor handled above
        const code = codeByCoord.get(
          `${f.anchorRow + dr},${f.anchorCol + dc}`
        );
        if (code) {
          result.set(code, {
            role: "covered-by-furniture",
            anchorCode: f.anchorCode,
          });
        }
      }
    }
  }

  // Default everything else to "normal"
  for (const cell of cells) {
    if (!result.has(cell.code)) {
      result.set(cell.code, { role: "normal" });
    }
  }
  return result;
}
