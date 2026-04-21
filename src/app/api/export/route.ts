import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTags } from "@/lib/types";
import { requirePlaceAccess } from "@/lib/require-place";

export const dynamic = "force-dynamic";

export async function GET() {
  const r = await requirePlaceAccess();
  if ("error" in r) return r.error;
  const { placeId } = r.access;

  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { name: true },
  });

  const [locations, boxes, moves] = await Promise.all([
    prisma.location.findMany({
      where: { placeId },
      orderBy: [{ row: "asc" }, { col: "asc" }],
    }),
    prisma.box.findMany({
      where: { placeId },
      include: { location: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.move.findMany({
      where: { box: { placeId } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 10,
    place: { name: place?.name ?? "Lieu" },
    locations: locations.map((l) => ({
      code: l.code, aisle: l.aisle, slot: l.slot, row: l.row, col: l.col,
      type: l.type, capacity: l.capacity, enabled: l.enabled,
    })),
    boxes: boxes.map((b) => ({
      id: b.id, name: b.name, description: b.description,
      tags: parseTags(b.tags), photoUrl: b.photoUrl, color: b.color,
      locationCode: b.location?.code ?? null,
      stackIndex: b.stackIndex,
      createdAt: b.createdAt.toISOString(),
    })),
    moves: moves.map((m) => ({
      boxId: m.boxId,
      fromCode: m.fromCode, toCode: m.toCode,
      fromStackIndex: m.fromStackIndex, toStackIndex: m.toStackIndex,
      reason: m.reason,
      createdAt: m.createdAt.toISOString(),
    })),
  };

  const slug = (place?.name ?? "lieu").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const filename = `box-ops-${slug}-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
