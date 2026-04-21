import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlaceAccess } from "@/lib/require-place";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const r = await requirePlaceAccess();
  if ("error" in r) return r.error;
  const { placeId } = r.access;

  const box = await prisma.box.findFirst({
    where: { id: params.id, placeId },
    select: { id: true },
  });
  if (!box) {
    return NextResponse.json({ error: "Boîte introuvable." }, { status: 404 });
  }

  const moves = await prisma.move.findMany({
    where: { boxId: params.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    moves.map((m) => ({
      id: m.id,
      fromCode: m.fromCode, toCode: m.toCode,
      fromStackIndex: m.fromStackIndex, toStackIndex: m.toStackIndex,
      reason: m.reason,
      createdAt: m.createdAt.toISOString(),
    }))
  );
}
