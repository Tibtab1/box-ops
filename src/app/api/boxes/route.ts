import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTags, serializeTags } from "@/lib/types";
import { logMove } from "@/lib/moves";
import { requireUserId } from "@/lib/require-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const boxes = await prisma.box.findMany({
    where: { userId: auth.userId },
    include: { location: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    boxes.map((b) => ({
      ...b,
      tags: parseTags(b.tags),
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }))
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;
  const { userId } = auth;

  const body = await req.json();
  const {
    name,
    description,
    tags,
    photoUrl,
    color,
    locationCode,
  }: {
    name?: string;
    description?: string;
    tags?: string[] | string;
    photoUrl?: string;
    color?: string;
    locationCode?: string | null;
  } = body;

  if (!name || !name.trim()) {
    return NextResponse.json(
      { error: "Le nom est obligatoire." },
      { status: 400 }
    );
  }

  let locationId: string | null = null;
  let stackIndex = 0;
  let resolvedCode: string | null = null;

  if (locationCode) {
    const loc = await prisma.location.findUnique({
      where: { userId_code: { userId, code: locationCode } },
      include: { boxes: true },
    });
    if (!loc) {
      return NextResponse.json(
        { error: `Emplacement ${locationCode} introuvable.` },
        { status: 400 }
      );
    }
    if (loc.type !== "cell" || !loc.enabled) {
      return NextResponse.json(
        { error: `${locationCode} n'est pas un emplacement actif.` },
        { status: 400 }
      );
    }
    if (loc.boxes.length >= loc.capacity) {
      return NextResponse.json(
        { error: `L'emplacement ${locationCode} est plein (${loc.capacity} max).` },
        { status: 409 }
      );
    }
    locationId = loc.id;
    stackIndex = loc.boxes.length;
    resolvedCode = loc.code;
  }

  const tagsStr = Array.isArray(tags) ? serializeTags(tags) : (tags ?? "");

  const box = await prisma.box.create({
    data: {
      userId,
      name: name.trim(),
      description: description?.trim() ?? null,
      tags: tagsStr,
      photoUrl: photoUrl ?? null,
      color: color ?? "#e8602c",
      locationId,
      stackIndex,
    },
    include: { location: true },
  });

  await logMove({
    boxId: box.id,
    fromCode: null,
    toCode: resolvedCode,
    fromStackIndex: null,
    toStackIndex: resolvedCode ? stackIndex : null,
    reason: "create",
  });

  return NextResponse.json(
    {
      ...box,
      tags: parseTags(box.tags),
      createdAt: box.createdAt.toISOString(),
      updatedAt: box.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}
