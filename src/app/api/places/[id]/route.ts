import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

async function getPlaceIfOwner(id: string) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { error: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };
  const place = await prisma.place.findUnique({ where: { id } });
  if (!place) return { error: NextResponse.json({ error: "Lieu introuvable." }, { status: 404 }) };
  if (place.ownerId !== userId) {
    return { error: NextResponse.json({ error: "Seul le propriétaire peut modifier/supprimer le lieu." }, { status: 403 }) };
  }
  return { place, userId };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  const place = await prisma.place.findFirst({
    where: {
      id: params.id,
      OR: [{ ownerId: userId }, { shares: { some: { userId } } }],
    },
    include: {
      shares: { where: { userId } },
      _count: { select: { locations: true, boxes: true } },
    },
  });
  if (!place) {
    return NextResponse.json({ error: "Lieu introuvable." }, { status: 404 });
  }
  return NextResponse.json({
    id: place.id,
    name: place.name,
    description: place.description,
    isOwner: place.ownerId === userId,
    role: place.ownerId === userId ? "owner" : (place.shares[0]?.role ?? "viewer"),
    locationsCount: place._count.locations,
    boxesCount: place._count.boxes,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await getPlaceIfOwner(params.id);
  if ("error" in result) return result.error;

  const body = await req.json().catch(() => null);
  const data: Record<string, unknown> = {};
  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Nom vide." }, { status: 400 });
    if (name.length > 80) return NextResponse.json({ error: "Nom trop long." }, { status: 400 });
    data.name = name;
  }
  if ("description" in (body ?? {})) {
    data.description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
  }

  const updated = await prisma.place.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json({ id: updated.id, name: updated.name });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await getPlaceIfOwner(params.id);
  if ("error" in result) return result.error;

  // Count places owned by the user; refuse to delete their last place
  const ownedCount = await prisma.place.count({
    where: { ownerId: result.userId },
  });
  if (ownedCount <= 1) {
    return NextResponse.json(
      { error: "Impossible de supprimer votre dernier lieu. Créez-en un autre d'abord." },
      { status: 409 }
    );
  }

  await prisma.place.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
