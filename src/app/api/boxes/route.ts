import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTags, serializeTags } from "@/lib/types";
import { logMove } from "@/lib/moves";
import { requirePlaceAccess } from "@/lib/require-place";
import { validateFurniturePlacement } from "@/lib/furniture";

export const dynamic = "force-dynamic";

export async function GET() {
  const r = await requirePlaceAccess();
  if ("error" in r) return r.error;
  const { placeId } = r.access;

  const boxes = await prisma.box.findMany({
    where: { placeId },
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
  const r = await requirePlaceAccess({ minRole: "editor" });
  if ("error" in r) return r.error;
  const { placeId, userId } = r.access;

  const body = await req.json();
  const {
    name, description, tags, photoUrl, color, locationCode,
    kind, spanW, spanH, parentId,
  }: {
    name?: string; description?: string; tags?: string[] | string;
    photoUrl?: string; color?: string; locationCode?: string | null;
    kind?: "box" | "furniture";
    spanW?: number; spanH?: number;
    parentId?: string | null;
  } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Le nom est obligatoire." }, { status: 400 });
  }

  const resolvedKind: "box" | "furniture" =
    kind === "furniture" ? "furniture" : "box";

  const resolvedSpanW =
    resolvedKind === "furniture"
      ? Math.max(1, Math.min(3, spanW ?? 1))
      : 1;
  const resolvedSpanH =
    resolvedKind === "furniture"
      ? Math.max(1, Math.min(3, spanH ?? 1))
      : 1;

  // Branch 1: box being created INSIDE a furniture (parentId provided)
  if (parentId) {
    const parent = await prisma.box.findFirst({
      where: { id: parentId, placeId, kind: "furniture" },
      include: { children: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "Meuble parent introuvable." }, { status: 400 });
    }
    if (resolvedKind === "furniture") {
      return NextResponse.json(
        { error: "Un meuble ne peut pas être rangé dans un autre meuble." },
        { status: 400 }
      );
    }
    const tagsStr = Array.isArray(tags) ? serializeTags(tags) : (tags ?? "");
    const stackIndex = parent.children.length;
    const box = await prisma.box.create({
      data: {
        placeId, userId,
        name: name.trim(),
        description: description?.trim() ?? null,
        tags: tagsStr,
        photoUrl: photoUrl ?? null,
        color: color ?? "#e8602c",
        kind: "box",
        spanW: 1, spanH: 1,
        locationId: null,
        stackIndex,
        parentId: parent.id,
      },
      include: { location: true },
    });
    await logMove({
      boxId: box.id,
      fromCode: null, toCode: null,
      fromStackIndex: null, toStackIndex: stackIndex,
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

  // Branch 2: furniture being placed on the main plan
  if (resolvedKind === "furniture") {
    if (!locationCode) {
      return NextResponse.json(
        { error: "Un meuble doit être placé sur une cellule d'ancrage." },
        { status: 400 }
      );
    }
    const placement = await validateFurniturePlacement({
      placeId,
      anchorCode: locationCode,
      spanW: resolvedSpanW,
      spanH: resolvedSpanH,
    });
    if (!placement.ok) {
      return NextResponse.json({ error: placement.error }, { status: 409 });
    }
    const tagsStr = Array.isArray(tags) ? serializeTags(tags) : (tags ?? "");
    const box = await prisma.box.create({
      data: {
        placeId, userId,
        name: name.trim(),
        description: description?.trim() ?? null,
        tags: tagsStr,
        photoUrl: photoUrl ?? null,
        color: color ?? "#8b7355",
        kind: "furniture",
        spanW: resolvedSpanW,
        spanH: resolvedSpanH,
        locationId: placement.anchorLocation.id,
        stackIndex: 0,
        parentId: null,
      },
      include: { location: true },
    });
    await logMove({
      boxId: box.id,
      fromCode: null, toCode: placement.anchorLocation.code,
      fromStackIndex: null, toStackIndex: 0,
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

  // Branch 3: normal box on main plan (default legacy behavior)
  let locationId: string | null = null;
  let stackIndex = 0;
  let resolvedCode: string | null = null;

  if (locationCode) {
    const loc = await prisma.location.findUnique({
      where: { placeId_code: { placeId, code: locationCode } },
      include: { boxes: { where: { kind: "box" } } },
    });
    if (!loc) {
      return NextResponse.json({ error: `Emplacement ${locationCode} introuvable.` }, { status: 400 });
    }
    if (loc.type !== "cell" || !loc.enabled) {
      return NextResponse.json({ error: `${locationCode} n'est pas un emplacement actif.` }, { status: 400 });
    }
    if (loc.boxes.length >= loc.capacity) {
      return NextResponse.json({ error: `L'emplacement ${locationCode} est plein (${loc.capacity} max).` }, { status: 409 });
    }
    locationId = loc.id;
    stackIndex = loc.boxes.length;
    resolvedCode = loc.code;
  }

  const tagsStr = Array.isArray(tags) ? serializeTags(tags) : (tags ?? "");

  const box = await prisma.box.create({
    data: {
      placeId, userId,
      name: name.trim(),
      description: description?.trim() ?? null,
      tags: tagsStr,
      photoUrl: photoUrl ?? null,
      color: color ?? "#e8602c",
      kind: "box",
      spanW: 1, spanH: 1,
      locationId, stackIndex,
      parentId: null,
    },
    include: { location: true },
  });

  await logMove({
    boxId: box.id,
    fromCode: null, toCode: resolvedCode,
    fromStackIndex: null, toStackIndex: resolvedCode ? stackIndex : null,
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
