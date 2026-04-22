// Helpers for multi-cell furniture items.
//
// A furniture item has an "anchor" cell (its top-left cell, stored as its
// locationId) and a (spanW, spanH) footprint. The cells it covers extend to
// the right and downward from the anchor.
//
// On the client we compute the covered cells from the anchor + span;
// on the server we validate that all covered cells exist and are free.
import { prisma } from "@/lib/prisma";

export type CellRef = {
  id: string;
  code: string;
  row: number;
  col: number;
  type: string;
  enabled: boolean;
  capacity: number;
};

/**
 * Given an anchor location and a (spanW, spanH), return the list of (row, col)
 * coordinates the footprint should cover. Returns [anchor] for 1x1.
 */
export function computeFootprintCoords(
  anchor: { row: number; col: number },
  spanW: number,
  spanH: number
): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  for (let dr = 0; dr < spanH; dr++) {
    for (let dc = 0; dc < spanW; dc++) {
      cells.push({ row: anchor.row + dr, col: anchor.col + dc });
    }
  }
  return cells;
}

/**
 * Check that a furniture footprint can be placed at `anchorCode` with given
 * dimensions in the given place:
 *  - All target cells must exist, be type="cell", enabled=true
 *  - None of the target cells may already host a furniture item (spanW/spanH > 1)
 *    that overlaps with our footprint
 *  - Box-kind items (normal boxes) stacked on these cells are OK — they will
 *    coexist with the furniture visually
 *
 * If `ignoreBoxId` is passed, its own cells are excluded from the conflict check
 * (useful when moving an existing furniture item).
 */
export async function validateFurniturePlacement(args: {
  placeId: string;
  anchorCode: string;
  spanW: number;
  spanH: number;
  ignoreBoxId?: string | null;
}): Promise<
  | { ok: true; anchorLocation: CellRef; coveredCells: CellRef[] }
  | { ok: false; error: string }
> {
  const { placeId, anchorCode, spanW, spanH } = args;

  if (spanW < 1 || spanW > 3 || spanH < 1 || spanH > 3) {
    return { ok: false, error: "Taille de meuble invalide (1 à 3 dans chaque dimension)." };
  }

  const anchor = await prisma.location.findUnique({
    where: { placeId_code: { placeId, code: anchorCode } },
  });
  if (!anchor) {
    return { ok: false, error: `Emplacement d'ancrage ${anchorCode} introuvable.` };
  }
  if (anchor.type !== "cell" || !anchor.enabled) {
    return { ok: false, error: `${anchorCode} n'est pas une cellule active.` };
  }

  const coords = computeFootprintCoords(
    { row: anchor.row, col: anchor.col },
    spanW,
    spanH
  );

  // Fetch all cells at those (row, col) positions in one go
  const cells = await prisma.location.findMany({
    where: {
      placeId,
      OR: coords.map((c) => ({ row: c.row, col: c.col })),
    },
  });

  // Build an index to check coverage
  const cellIndex = new Map<string, (typeof cells)[number]>();
  for (const c of cells) cellIndex.set(`${c.row},${c.col}`, c);

  for (const coord of coords) {
    const cell = cellIndex.get(`${coord.row},${coord.col}`);
    if (!cell) {
      return {
        ok: false,
        error: `Toutes les cellules nécessaires (${spanW}×${spanH}) ne sont pas disponibles. La cellule en ligne ${coord.row}, colonne ${coord.col} manque.`,
      };
    }
    if (cell.type !== "cell" || !cell.enabled) {
      return {
        ok: false,
        error: `La cellule ${cell.code} n'est pas active — elle ne peut pas être couverte par le meuble.`,
      };
    }
  }

  // Check furniture conflicts on any covered cell
  const conflictingFurniture = await prisma.box.findMany({
    where: {
      placeId,
      kind: "furniture",
      locationId: { in: cells.map((c) => c.id) },
      ...(args.ignoreBoxId ? { id: { not: args.ignoreBoxId } } : {}),
    },
  });
  // Also: check for furniture whose footprint *overlaps* our footprint, even
  // if their anchor is not on our covered cells (their anchor is elsewhere
  // but their footprint extends into our target area).
  const allFurniture = await prisma.box.findMany({
    where: {
      placeId,
      kind: "furniture",
      locationId: { not: null },
      ...(args.ignoreBoxId ? { id: { not: args.ignoreBoxId } } : {}),
    },
    include: { location: true },
  });

  const myCoordSet = new Set(coords.map((c) => `${c.row},${c.col}`));
  for (const f of allFurniture) {
    if (!f.location) continue;
    const fCoords = computeFootprintCoords(
      { row: f.location.row, col: f.location.col },
      f.spanW,
      f.spanH
    );
    for (const fc of fCoords) {
      if (myCoordSet.has(`${fc.row},${fc.col}`)) {
        return {
          ok: false,
          error: `Le meuble « ${f.name} » occupe déjà cet espace.`,
        };
      }
    }
  }

  // Keep the linter happy about unused `conflictingFurniture`
  void conflictingFurniture;

  const anchorCell: CellRef = {
    id: anchor.id,
    code: anchor.code,
    row: anchor.row,
    col: anchor.col,
    type: anchor.type,
    enabled: anchor.enabled,
    capacity: anchor.capacity,
  };
  const coveredCells: CellRef[] = cells.map((c) => ({
    id: c.id,
    code: c.code,
    row: c.row,
    col: c.col,
    type: c.type,
    enabled: c.enabled,
    capacity: c.capacity,
  }));

  return { ok: true, anchorLocation: anchorCell, coveredCells };
}
