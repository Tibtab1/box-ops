import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTags, serializeTags, areAdjacent } from "@/lib/types";
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
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(
    boxes.map((b) => ({
      id: b.id,
      name: b.name,
      color: b.color,
      tags: parseTags(b.tags),
      kind: b.kind,
      flatType: b.flatType,
      isFragile: b.isFragile,
      flatEdgeRowA: b.flatEdgeRowA,
      flatEdgeColA: b.flatEdgeColA,
      flatEdgeRowB: b.flatEdgeRowB,
      flatEdgeColB: b.flatEdgeColB,
      location: b.location
        ? { code: b.location.code, row: b.location.row, col: b.location.col }
        : null,
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
    widthCm, heightCm, flatType, isFragile, estimatedValueCents,
    flatEdgeRowA, flatEdgeColA, flatEdgeRowB, flatEdgeColB,
  }: {
    name?: string; description?: string; tags?: string[] | string;
    photoUrl?: string; color?: string; locationCode?: string | null;
    kind?: "box" | "furniture" | "flat";
    spanW?: number; spanH?: number;
    parentId?: string | null;
    widthCm?: number | null;
    heightCm?: number | null;
    flatType?: "painting" | "photo" | "poster" | "mirror" | "other" | null;
    isFragile?: boolean;
    estimatedValueCents?: number | null;
    flatEdgeRowA?: number | null;
    flatEdgeColA?: number | null;
    flatEdgeRowB?: number | null;
    flatEdgeColB?: number | null;
  } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Le nom est obligatoire." }, { status: 400 });
  }

  const resolvedKind: "box" | "furniture" | "flat" =
    kind === "furniture" ? "furniture" :
    kind === "flat" ? "flat" : "box";

  const resolvedSpanW =
    resolvedKind === "furniture" ? Math.max(1, Math.min(3, spanW ?? 1)) : 1;
  const resolvedSpanH =
    resolvedKind === "furniture" ? Math.max(1, Math.min(3, spanH ?? 1)) : 1;

  // Validate flat-specific fields
  const validFlatTypes = ["painting", "photo", "poster", "mirror", "other"] as const;
  const resolvedFlatType =
    resolvedKind === "flat" && flatType && validFlatTypes.includes(flatType)
      ? flatType : null;
  const resolvedWidthCm =
    resolvedKind === "flat" && typeof widthCm === "number" && widthCm > 0 && widthCm < 10000
      ? Math.round(widthCm) : null;
  const resolvedHeightCm =
    resolvedKind === "flat" && typeof heightCm === "number" && heightCm > 0 && heightCm < 10000
      ? Math.round(heightCm) : null;
  const resolvedFragile = resolvedKind === "flat" ? !!isFragile : false;
  const resolvedValueCents =
    resolvedKind === "flat" && typeof estimatedValueCents === "number" && estimatedValueCents >= 0 && estimatedValueCents < 100000000
      ? Math.round(estimatedValueCents) : null;

  // Validate flat edge coordinates
  let edgeRowA: number | null = null;
  let edgeColA: number | null = null;
  let edgeRowB: number | null = null;
  let edgeColB: number | null = null;
  if (resolvedKind === "flat") {
    if (typeof flatEdgeRowA !== "number" || typeof flatEdgeColA !== "number") {
      return NextResponse.json({ error: "Position du cadre manquante (cellule A)." }, { status: 400 });
    }
    edgeRowA = flatEdgeRowA;
    edgeColA = flatEdgeColA;
    if (typeof flatEdgeRowB === "number" && typeof flatEdgeColB === "number") {
      if (!areAdjacent(edgeRowA, edgeColA, flatEdgeRowB, flatEdgeColB)) {
        return NextResponse.json({
          error: "Les cellules de l'arête doivent être adjacentes."
        }, { status: 400 });
      }
      edgeRowB = flatEdgeRowB;
      edgeColB = flatEdgeColB;
    }
    // else: outer edge, B stays null
  }

  // Common writable fields (no locationId / stackIndex / spanW / spanH /
  // edge coords here — set per-branch).
  const baseData = {
    name: name.trim(),
    description: typeof description === "string" ? description.trim() : "",
    tags: Array.isArray(tags) ? serializeTags(tags) : (typeof tags === "string" ? tags : ""),
    photoUrl: typeof photoUrl === "string" ? photoUrl : null,
    color: color || "#e8602c",
    placeId,
    userId,
    widthCm: resolvedWidthCm,
    heightCm: resolvedHeightCm,
    flatType: resolvedFlatType,
    isFragile: resolvedFragile,
    estimatedValueCents: resolvedValueCents,
  };

  // Branch 1: child inside a furniture (boxes/flats can be inside furniture)
  if (parentId) {
    const parent = await prisma.box.findFirst({
      where: { id: parentId, placeId, kind: "furniture" },
      include: { children: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "Meuble parent introuvable." }, { status: 400 });
    }
    const created = await prisma.box.create({
      data: {
        ...baseData,
        parentId: parent.id,
        locationId: null,
        kind: resolvedKind === "flat" ? "flat" : "box",
        spanW: 1, spanH: 1,
        stackIndex: parent.children.length,
        flatEdgeRowA: null, flatEdgeColA: null,
        flatEdgeRowB: null, flatEdgeColB: null,
      },
      include: { location: true },
    });
    await logMove({
      boxId: created.id, fromCode: null, toCode: null,
      fromStackIndex: null, toStackIndex: parent.children.length,
      reason: "create",
    });
    return NextResponse.json({
      ...created,
      tags: parseTags(created.tags),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  }

  // Branch 2: furniture on the plan
  if (resolvedKind === "furniture") {
    if (!locationCode) {
      return NextResponse.json({ error: "Une cellule d'ancrage est requise." }, { status: 400 });
    }
    const placement = await validateFurniturePlacement({
      placeId, anchorCode: locationCode,
      spanW: resolvedSpanW, spanH: resolvedSpanH,
    });
    if (!placement.ok) {
      return NextResponse.json({ error: placement.error }, { status: 409 });
    }
    const created = await prisma.box.create({
      data: {
        ...baseData,
        kind: "furniture",
        spanW: resolvedSpanW, spanH: resolvedSpanH,
        locationId: placement.anchorLocation.id,
        stackIndex: 0, parentId: null,
        flatEdgeRowA: null, flatEdgeColA: null,
        flatEdgeRowB: null, flatEdgeColB: null,
      },
      include: { location: true },
    });
    await logMove({
      boxId: created.id, fromCode: null, toCode: placement.anchorLocation.code,
      fromStackIndex: null, toStackIndex: 0, reason: "create",
    });
    return NextResponse.json({
      ...created,
      tags: parseTags(created.tags),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  }

  // Branch 3a: FLAT on the plan — placed on an edge between two cells (or
  // a cell and the outer boundary). Does not consume a cell stack slot.
  if (resolvedKind === "flat") {
    // Compute next stackIndex on this edge (if multiple flats share it)
    const edgeKey =
      edgeRowB !== null && edgeColB !== null
        ? { flatEdgeRowA: edgeRowA!, flatEdgeColA: edgeColA!, flatEdgeRowB: edgeRowB, flatEdgeColB: edgeColB }
        : { flatEdgeRowA: edgeRowA!, flatEdgeColA: edgeColA!, flatEdgeRowB: null, flatEdgeColB: null };
    // Look for normalized edge: also (B,A) pair
    const sameEdgeFlats = await prisma.box.findMany({
      where: {
        placeId,
        kind: "flat",
        OR: [
          edgeKey,
          edgeRowB !== null && edgeColB !== null
            ? { flatEdgeRowA: edgeRowB, flatEdgeColA: edgeColB, flatEdgeRowB: edgeRowA!, flatEdgeColB: edgeColA! }
            : { flatEdgeRowA: -1, flatEdgeColA: -1 }, // dummy that won't match
        ],
      },
    });
    const nextStackIndex = sameEdgeFlats.length;

    const created = await prisma.box.create({
      data: {
        ...baseData,
        kind: "flat",
        spanW: 1, spanH: 1,
        locationId: null,
        stackIndex: nextStackIndex,
        parentId: null,
        flatEdgeRowA: edgeRowA,
        flatEdgeColA: edgeColA,
        flatEdgeRowB: edgeRowB,
        flatEdgeColB: edgeColB,
      },
    });
    await logMove({
      boxId: created.id, fromCode: null, toCode: null,
      fromStackIndex: null, toStackIndex: nextStackIndex, reason: "create",
    });
    return NextResponse.json({
      ...created,
      tags: parseTags(created.tags),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  }

  // Branch 3b: regular box on the plan
  let locationId: string | null = null;
  let stackIndex = 0;
  if (locationCode) {
    const dest = await prisma.location.findUnique({
      where: { placeId_code: { placeId, code: locationCode } },
      include: {
        boxes: { where: { kind: "box" } },
      },
    });
    if (!dest) {
      return NextResponse.json({ error: `Emplacement ${locationCode} introuvable.` }, { status: 400 });
    }
    if (dest.type !== "cell" || !dest.enabled) {
      return NextResponse.json({ error: `${locationCode} n'est pas un emplacement actif.` }, { status: 400 });
    }
    if (dest.boxes.length >= dest.capacity) {
      return NextResponse.json({ error: `L'emplacement ${locationCode} est plein (${dest.capacity} max).` }, { status: 409 });
    }
    locationId = dest.id;
    stackIndex = dest.boxes.length;
  }

  const created = await prisma.box.create({
    data: {
      ...baseData,
      kind: "box",
      spanW: 1, spanH: 1,
      locationId, stackIndex, parentId: null,
      flatEdgeRowA: null, flatEdgeColA: null,
      flatEdgeRowB: null, flatEdgeColB: null,
    },
    include: { location: true },
  });

  if (locationCode && created.location) {
    await logMove({
      boxId: created.id, fromCode: null, toCode: created.location.code,
      fromStackIndex: null, toStackIndex: stackIndex, reason: "create",
    });
  }

  return NextResponse.json({
    ...created,
    tags: parseTags(created.tags),
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  });
}
