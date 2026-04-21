import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const { direction } = (await req.json()) as { direction: "up" | "down" };

  const box = await prisma.box.findFirst({
    where: { id: params.id, userId: auth.userId },
  });
  if (!box || !box.locationId) {
    return NextResponse.json(
      { error: "Boîte ou emplacement introuvable." },
      { status: 404 }
    );
  }

  const delta = direction === "up" ? 1 : -1;
  const neighbor = await prisma.box.findFirst({
    where: {
      locationId: box.locationId,
      stackIndex: box.stackIndex + delta,
    },
  });
  if (!neighbor) {
    return NextResponse.json(
      { error: "Pas de boîte à échanger dans cette direction." },
      { status: 400 }
    );
  }

  await prisma.box.update({ where: { id: box.id }, data: { stackIndex: -1 } });
  await prisma.box.update({
    where: { id: neighbor.id },
    data: { stackIndex: box.stackIndex },
  });
  await prisma.box.update({
    where: { id: box.id },
    data: { stackIndex: neighbor.stackIndex },
  });

  return NextResponse.json({ ok: true });
}
