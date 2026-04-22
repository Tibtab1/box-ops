import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTags } from "@/lib/types";
import { requirePlaceAccess } from "@/lib/require-place";

export const dynamic = "force-dynamic";

// GET /api/locations
//
// v13: each Box now carries `kind` (box | furniture), `spanW`, `spanH`, and
// `parentId`. We expose them so the client can render furniture items that
// span multiple cells. Boxes stored *inside* furniture (parentId != null) are
// excluded from cell contents — they live in their parent's "inner view".
export async function GET() {
  const r = await requirePlaceAccess();
  if ("error" in r) return r.error;
  const { placeId } = r.access;

  const locations = await prisma.location.findMany({
    where: { placeId },
    include: {
      boxes: {
        where: { parentId: null },
        orderBy: { stackIndex: "asc" },
      },
    },
    orderBy: [{ row: "asc" }, { col: "asc" }],
  });

  return NextResponse.json(
    locations.map((l) => ({
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
      })),
    }))
  );
}
