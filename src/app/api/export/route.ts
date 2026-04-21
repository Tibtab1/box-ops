import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTags } from "@/lib/types";
import { requireUserId } from "@/lib/require-user";

export const dynamic = "force-dynamic";

// GET /api/export — full JSON dump scoped to the current user
export async function GET() {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const [locations, boxes, moves] = await Promise.all([
    prisma.location.findMany({
      where: { userId: auth.userId },
      orderBy: [{ row: "asc" }, { col: "asc" }],
    }),
    prisma.box.findMany({
      where: { userId: auth.userId },
      include: { location: true },
      orderBy: { createdAt: "asc" },
    }),
    // Moves inherit their scoping through the Box foreign key
    prisma.move.findMany({
      where: { box: { userId: auth.userId } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 8,
    locations: locations.map((l) => ({
      code: l.code,
      aisle: l.aisle,
      slot: l.slot,
      row: l.row,
      col: l.col,
      type: l.type,
      capacity: l.capacity,
      enabled: l.enabled,
    })),
    boxes: boxes.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      tags: parseTags(b.tags),
      photoUrl: b.photoUrl,
      color: b.color,
      locationCode: b.location?.code ?? null,
      stackIndex: b.stackIndex,
      createdAt: b.createdAt.toISOString(),
    })),
    moves: moves.map((m) => ({
      boxId: m.boxId,
      fromCode: m.fromCode,
      toCode: m.toCode,
      fromStackIndex: m.fromStackIndex,
      toStackIndex: m.toStackIndex,
      reason: m.reason,
      createdAt: m.createdAt.toISOString(),
    })),
  };

  const filename = `box-ops-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
