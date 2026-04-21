import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTags } from "@/lib/types";
import { requireUserId } from "@/lib/require-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const locations = await prisma.location.findMany({
    where: { userId: auth.userId },
    include: {
      boxes: {
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
      })),
    }))
  );
}
