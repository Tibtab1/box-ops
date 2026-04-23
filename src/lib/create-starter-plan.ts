// Build a starter grid of cells for a freshly-created Place.
//
// `rows` × `cols` cells will be created, with codes like R1-1, R1-2, …
// Columns are stored 0-indexed in the DB (historical) but the `code` and
// `slot` use 1-indexed for user display — we keep that convention.
//
// Returns the number of cells created.
import { prisma } from "@/lib/prisma";
import { DEFAULT_CELL_CAPACITY } from "@/lib/plan-presets";

export async function createStarterPlan(args: {
  placeId: string;
  userId: string;
  rows: number;
  cols: number;
}): Promise<number> {
  const rows = Math.max(1, Math.min(20, Math.floor(args.rows)));
  const cols = Math.max(1, Math.min(30, Math.floor(args.cols)));

  const data: Array<{
    placeId: string;
    userId: string;
    code: string;
    aisle: string;
    slot: number;
    row: number;
    col: number;
    type: string;
    capacity: number;
    enabled: boolean;
  }> = [];

  for (let r = 1; r <= rows; r++) {
    const aisle = `R${r}`;
    for (let c = 0; c < cols; c++) {
      data.push({
        placeId: args.placeId,
        userId: args.userId,
        code: `${aisle}-${c + 1}`,
        aisle,
        slot: c + 1,
        row: r,
        col: c,
        type: "cell",
        capacity: DEFAULT_CELL_CAPACITY,
        enabled: true,
      });
    }
  }

  // createMany is much faster than N individual creates
  const result = await prisma.location.createMany({ data });
  return result.count;
}
