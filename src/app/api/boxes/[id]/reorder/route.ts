import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlaceAccess } from "@/lib/require-place";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const r = await requirePlaceAccess({ minRole: "editor" });
  if ("error" in r) return r.error;
  const { placeId } = r.access;

  const { direction } = (await req.json()) as { direction: "up" | "down" };

  const box = await prisma.box.findFirst({
    where: { id: params.id, placeId },
  });
  if (!box || !box.locationId) {
    return NextResponse.json({ error: "Boîte ou emplacement introuvable." }, { status: 404 });
  }

  const delta = direction === "up" ? 1 : -1;
  const neighbor = await prisma.box.findFirst({
    where: { locationId: box.locationId, stackIndex: box.stackIndex + delta },
  });
  if (!neighbor) {
    return NextResponse.json({ error: "Pas de boîte à échanger." }, { status: 400 });
  }

  await prisma.box.update({ where: { id: box.id }, data: { stackIndex: -1 } });
  await prisma.box.update({ where: { id: neighbor.id }, data: { stackIndex: box.stackIndex } });
  await prisma.box.update({ where: { id: box.id }, data: { stackIndex: neighbor.stackIndex } });

  return NextResponse.json({ ok: true });
}
