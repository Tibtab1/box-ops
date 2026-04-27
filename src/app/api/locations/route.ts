import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTags } from "@/lib/types";
import { requirePlaceAccess } from "@/lib/require-place";

export const dynamic = "force-dynamic";

// GET /api/locations
//
// v14: returns an object { cells, flats }.
//   - cells: cells with their stacked boxes/furniture (flats no longer in here)
//   - flats: top-level array of frame items, each living on an edge between
//     two cells (or a cell + outer space)
export async function GET() {
  const r = await requirePlaceAccess();
  if ("error" in r) return r.error;
  const { placeId } = r.access;

  const locations = await prisma.location.findMany({
    where: { placeId },
    include: {
      // Only include children that actually live in cells: boxes and furniture.
      // Flats no longer have a locationId.
      boxes: {
        where: { parentId: null, kind: { in: ["box", "furniture"] } },
        orderBy: { stackIndex: "asc" },
      },
    },
    orderBy: [{ row: "asc" }, { col: "asc" }],
  });

  const cells = locations.map((l) => ({
    id: l.id,
    code: l.code,
    aisle: l.aisle,
    slot: l.slot,
    row: l.row,
    col: l.col,
    type: l.type,
    capacity: l.capacity,
    enabled: l.enabled,
    boxes: l.boxes.map((b) => ({
      id: b.id,
      name: b.name,
      color: b.color,
      tags: parseTags(b.tags),
      stackIndex: b.stackIndex,
      kind: b.kind,
      spanW: b.spanW,
      spanH: b.spanH,
      flatType: b.flatType,
      isFragile: b.isFragile,
    })),
  }));

  // Fetch all flats for this place (they're not attached to a cell anymore)
  const flatRows = await prisma.box.findMany({
    where: { placeId, kind: "flat", parentId: null },
    orderBy: [{ flatEdgeRowA: "asc" }, { flatEdgeColA: "asc" }, { stackIndex: "asc" }],
  });

  const flats = flatRows
    .filter((f) => f.flatEdgeRowA !== null && f.flatEdgeColA !== null)
    .map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color,
      tags: parseTags(f.tags),
      flatType: f.flatType as "painting" | "photo" | "poster" | "mirror" | "other" | null,
      isFragile: f.isFragile,
      rowA: f.flatEdgeRowA as number,
      colA: f.flatEdgeColA as number,
      rowB: f.flatEdgeRowB,
      colB: f.flatEdgeColB,
      stackIndex: f.stackIndex,
    }));

  return NextResponse.json({ cells, flats });
}
