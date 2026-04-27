import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTags, serializeTags } from "@/lib/types";
import { logMove } from "@/lib/moves";
import { requirePlaceAccess } from "@/lib/require-place";
import { pushUndoEntry } from "@/lib/undo";
import { validateFurniturePlacement } from "@/lib/furniture";

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
    include: { location: true, parent: true },
  });
  if (!box) {
    return NextResponse.json({ error: "Boîte introuvable." }, { status: 404 });
  }

  const neighbors: Record<"left" | "right" | "front" | "back", unknown> = {
    left: null, right: null, front: null, back: null,
  };
  let stack: Array<{ id: string; name: string; color: string; stackIndex: number; isSelf: boolean; kind: string }> = [];
  let capacity = 0;
  let children: Array<{ id: string; name: string; color: string; stackIndex: number }> = [];

  // If this is a furniture, expose its children (inner contents)
  if (box.kind === "furniture") {
    const childRows = await prisma.box.findMany({
      where: { parentId: box.id },
      orderBy: { stackIndex: "asc" },
    });
    children = childRows.map((c) => ({
      id: c.id, name: c.name, color: c.color, stackIndex: c.stackIndex,
    }));
  }

  if (box.location && !box.parentId && (box.kind === "box")) {
    const { row, col, id: locId, capacity: cap } = box.location;
    capacity = cap;

    const siblings = await prisma.box.findMany({
      where: { locationId: locId, kind: "box" },
      orderBy: { stackIndex: "asc" },
    });
    stack = siblings.map((s) => ({
      id: s.id, name: s.name, color: s.color,
      stackIndex: s.stackIndex, isSelf: s.id === box.id, kind: s.kind,
    }));

    const offsets: Array<{ key: keyof typeof neighbors; dr: number; dc: number }> = [
      { key: "left", dr: 0, dc: -1 },
      { key: "right", dr: 0, dc: 1 },
      { key: "back", dr: -1, dc: 0 },
      { key: "front", dr: 1, dc: 0 },
    ];
    for (const o of offsets) {
      const loc = await prisma.location.findFirst({
        where: { placeId, row: row + o.dr, col: col + o.dc, type: "cell", enabled: true },
        include: { boxes: { where: { kind: "box" }, orderBy: { stackIndex: "desc" }, take: 1 } },
      });
      const top = loc?.boxes?.[0];
      if (top) {
        neighbors[o.key] = {
          id: top.id, name: top.name, color: top.color,
          tags: parseTags(top.tags),
          location: { code: loc!.code, row: loc!.row, col: loc!.col },
          stackSize: await prisma.box.count({ where: { locationId: loc!.id, kind: "box" } }),
        };
      }
    }
  }

  return NextResponse.json({
    box: {
      ...box,
      tags: parseTags(box.tags),
      sku: box.sku ?? null,
      quantity: box.quantity,
      createdAt: box.createdAt.toISOString(),
      updatedAt: box.updatedAt.toISOString(),
    },
    neighbors, stack, capacity, children,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const r = await requirePlaceAccess({ minRole: "editor" });
  if ("error" in r) return r.error;
  const { placeId, userId } = r.access;

  const body = await req.json();
  const box = await prisma.box.findFirst({
    where: { id: params.id, placeId },
    include: { location: true },
  });
  if (!box) {
    return NextResponse.json({ error: "Boîte introuvable." }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.description === "string") data.description = body.description.trim();
  if (typeof body.color === "string") data.color = body.color;
  if (typeof body.photoUrl === "string" || body.photoUrl === null) data.photoUrl = body.photoUrl;
  if (Array.isArray(body.tags)) data.tags = serializeTags(body.tags);
  else if (typeof body.tags === "string") data.tags = body.tags;
  if (typeof body.sku === "string") data.sku = body.sku.trim() || null;
  else if (body.sku === null) data.sku = null;
  if (typeof body.quantity === "number" && body.quantity >= 1) data.quantity = Math.round(body.quantity);

  // Flat-specific fields (only meaningful when box is a flat)
  if (box.kind === "flat") {
    if (typeof body.widthCm === "number" && body.widthCm > 0 && body.widthCm < 10000) {
      data.widthCm = Math.round(body.widthCm);
    } else if (body.widthCm === null) {
      data.widthCm = null;
    }
    if (typeof body.heightCm === "number" && body.heightCm > 0 && body.heightCm < 10000) {
      data.heightCm = Math.round(body.heightCm);
    } else if (body.heightCm === null) {
      data.heightCm = null;
    }
    const validFlatTypes = ["painting", "photo", "poster", "mirror", "other"];
    if (typeof body.flatType === "string" && validFlatTypes.includes(body.flatType)) {
      data.flatType = body.flatType;
    } else if (body.flatType === null) {
      data.flatType = null;
    }
    if (typeof body.isFragile === "boolean") {
      data.isFragile = body.isFragile;
    }
    if (typeof body.estimatedValueCents === "number" && body.estimatedValueCents >= 0 && body.estimatedValueCents < 100000000) {
      data.estimatedValueCents = Math.round(body.estimatedValueCents);
    } else if (body.estimatedValueCents === null) {
      data.estimatedValueCents = null;
    }
    // Edge coordinates: when the user moves a flat to another edge.
    // We accept all 4 together (rowA, colA, rowB, colB) — rowB/colB can be null.
    if (
      typeof body.flatEdgeRowA === "number" &&
      typeof body.flatEdgeColA === "number"
    ) {
      const aR = body.flatEdgeRowA;
      const aC = body.flatEdgeColA;
      const bR = typeof body.flatEdgeRowB === "number" ? body.flatEdgeRowB : null;
      const bC = typeof body.flatEdgeColB === "number" ? body.flatEdgeColB : null;
      if (bR !== null && bC !== null) {
        // Validate adjacency
        const dr = Math.abs(aR - bR);
        const dc = Math.abs(aC - bC);
        if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) {
          return NextResponse.json({
            error: "Les cellules de l'arête doivent être adjacentes."
          }, { status: 400 });
        }
      }
      data.flatEdgeRowA = aR;
      data.flatEdgeColA = aC;
      data.flatEdgeRowB = bR;
      data.flatEdgeColB = bC;
    }
  }

  // === Case A: moving a FURNITURE item ======================================
  if (box.kind === "furniture") {
    // Optionally accept spanW/spanH changes (resize)
    let newSpanW = box.spanW;
    let newSpanH = box.spanH;
    if (typeof body.spanW === "number") newSpanW = Math.max(1, Math.min(3, body.spanW));
    if (typeof body.spanH === "number") newSpanH = Math.max(1, Math.min(3, body.spanH));

    const wantsMove =
      "locationCode" in body || newSpanW !== box.spanW || newSpanH !== box.spanH;

    if (wantsMove) {
      const targetCode =
        "locationCode" in body && body.locationCode !== null && body.locationCode !== ""
          ? (body.locationCode as string)
          : box.location?.code;

      if (!targetCode) {
        return NextResponse.json(
          { error: "Un meuble doit rester ancré à une cellule." },
          { status: 400 }
        );
      }

      const placement = await validateFurniturePlacement({
        placeId,
        anchorCode: targetCode,
        spanW: newSpanW,
        spanH: newSpanH,
        ignoreBoxId: box.id,
      });
      if (!placement.ok) {
        return NextResponse.json({ error: placement.error }, { status: 409 });
      }

      const oldCode = box.location?.code ?? null;
      const oldLocationId = box.locationId;

      data.locationId = placement.anchorLocation.id;
      data.spanW = newSpanW;
      data.spanH = newSpanH;

      const updated = await prisma.box.update({
        where: { id: box.id },
        data,
        include: { location: true },
      });

      if (oldCode !== placement.anchorLocation.code) {
        await logMove({
          boxId: box.id,
          fromCode: oldCode, toCode: placement.anchorLocation.code,
          fromStackIndex: null, toStackIndex: 0,
          reason: "move",
        });
        if (oldLocationId) {
          await pushUndoEntry({
            userId, placeId,
            kind: "move_furniture",
            payload: {
              boxId: box.id,
              targetLocationId: oldLocationId,
              targetStackIndex: 0,
              previousCode: oldCode,
              previousSpanW: box.spanW,
              previousSpanH: box.spanH,
            },
            label: `Meuble « ${box.name} » déplacé vers ${placement.anchorLocation.code}`,
          });
        }
      }

      return NextResponse.json({
        ...updated,
        tags: parseTags(updated.tags),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    }

    // No move requested — just update other fields
    const updated = await prisma.box.update({
      where: { id: box.id },
      data,
      include: { location: true },
    });
    return NextResponse.json({
      ...updated,
      tags: parseTags(updated.tags),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  }

  // === Case B: moving a BOX in/out of a FURNITURE =========================
  if ("parentId" in body) {
    const oldParentId = box.parentId;
    const oldStackIndex = box.stackIndex;

    if (body.parentId === null) {
      // Removing from furniture: box becomes unplaced (no location)
      const above = await prisma.box.findMany({
        where: { parentId: oldParentId, stackIndex: { gt: oldStackIndex } },
        orderBy: { stackIndex: "asc" },
      });
      data.parentId = null;
      data.locationId = null;
      data.stackIndex = 0;
      const updated = await prisma.box.update({
        where: { id: box.id },
        data,
        include: { location: true },
      });
      // Compact remaining children
      for (const b of above) {
        await prisma.box.update({
          where: { id: b.id },
          data: { stackIndex: b.stackIndex - 1 },
        });
      }
      return NextResponse.json({
        ...updated,
        tags: parseTags(updated.tags),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    } else {
      const newParent = await prisma.box.findFirst({
        where: {
          id: body.parentId as string,
          placeId,
          kind: "furniture",
        },
        include: { children: true },
      });
      if (!newParent) {
        return NextResponse.json({ error: "Meuble parent introuvable." }, { status: 400 });
      }
      // Compact old location/parent
      if (oldParentId) {
        const above = await prisma.box.findMany({
          where: { parentId: oldParentId, stackIndex: { gt: oldStackIndex } },
          orderBy: { stackIndex: "asc" },
        });
        data.parentId = newParent.id;
        data.locationId = null;
        data.stackIndex = newParent.children.length;
        const updated = await prisma.box.update({
          where: { id: box.id },
          data,
          include: { location: true },
        });
        for (const b of above) {
          await prisma.box.update({
            where: { id: b.id },
            data: { stackIndex: b.stackIndex - 1 },
          });
        }
        return NextResponse.json({
          ...updated,
          tags: parseTags(updated.tags),
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        });
      }
      // Coming from main plan (box had locationId)
      if (box.locationId) {
        await compactStack(box.locationId, oldStackIndex);
      }
      data.parentId = newParent.id;
      data.locationId = null;
      data.stackIndex = newParent.children.length;
      const updated = await prisma.box.update({
        where: { id: box.id },
        data,
        include: { location: true },
      });
      await logMove({
        boxId: box.id,
        fromCode: box.location?.code ?? null, toCode: null,
        fromStackIndex: oldStackIndex, toStackIndex: newParent.children.length,
        reason: "move",
      });
      return NextResponse.json({
        ...updated,
        tags: parseTags(updated.tags),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    }
  }

  // === Case C: normal box location change (legacy) =========================
  if ("locationCode" in body) {
    const oldLocationId = box.locationId;
    const oldStackIndex = box.stackIndex;
    const oldCode = box.location?.code ?? null;
    let didRelocate = false;
    let newCode: string | null = null;
    let newStackIndex: number | null = null;

    if (body.locationCode === null || body.locationCode === "") {
      data.locationId = null;
      data.stackIndex = 0;
      didRelocate = oldLocationId !== null;
    } else {
      const dest = await prisma.location.findUnique({
        where: { placeId_code: { placeId, code: body.locationCode } },
        include: { boxes: { where: { kind: "box" } } },
      });
      if (!dest) {
        return NextResponse.json({ error: `Emplacement ${body.locationCode} introuvable.` }, { status: 400 });
      }
      if (dest.type !== "cell" || !dest.enabled) {
        return NextResponse.json({ error: `${body.locationCode} n'est pas un emplacement actif.` }, { status: 400 });
      }
      if (dest.id !== oldLocationId) {
        const stackSize = dest.boxes.length;
        if (stackSize >= dest.capacity) {
          return NextResponse.json({ error: `L'emplacement ${body.locationCode} est plein (${dest.capacity} max).` }, { status: 409 });
        }
        data.locationId = dest.id;
        data.stackIndex = stackSize;
        didRelocate = true;
        newCode = dest.code;
        newStackIndex = stackSize;
      }
    }

    const updated = await prisma.box.update({
      where: { id: params.id },
      data,
      include: { location: true },
    });

    if (didRelocate && oldLocationId) {
      await compactStack(oldLocationId, oldStackIndex);
    }

    if (didRelocate) {
      await logMove({
        boxId: box.id,
        fromCode: oldCode, toCode: newCode,
        fromStackIndex: oldCode ? oldStackIndex : null,
        toStackIndex: newStackIndex,
        reason: newCode ? "move" : "detach",
      });
      await pushUndoEntry({
        userId, placeId,
        kind: "move_box",
        payload: {
          boxId: box.id,
          targetLocationId: oldLocationId,
          targetStackIndex: oldStackIndex,
          previousCode: oldCode,
        },
        label: newCode
          ? `Déplacement de « ${box.name} » vers ${newCode}`
          : `« ${box.name} » retirée de ${oldCode}`,
      });
    }

    return NextResponse.json({
      ...updated,
      tags: parseTags(updated.tags),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  }

  const updated = await prisma.box.update({
    where: { id: params.id },
    data,
    include: { location: true },
  });

  return NextResponse.json({
    ...updated,
    tags: parseTags(updated.tags),
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const r = await requirePlaceAccess({ minRole: "editor" });
  if ("error" in r) return r.error;
  const { placeId } = r.access;

  const box = await prisma.box.findFirst({
    where: { id: params.id, placeId },
  });
  if (!box) return NextResponse.json({ ok: true });

  // If deleting a furniture with children, move them to unplaced (detach parentId)
  if (box.kind === "furniture") {
    await prisma.box.updateMany({
      where: { parentId: box.id },
      data: { parentId: null, locationId: null, stackIndex: 0 },
    });
  }

  await prisma.box.delete({ where: { id: params.id } });

  if (box.locationId && (box.kind === "box")) {
    await compactStack(box.locationId, box.stackIndex);
  }
  if (box.parentId) {
    const above = await prisma.box.findMany({
      where: { parentId: box.parentId, stackIndex: { gt: box.stackIndex } },
      orderBy: { stackIndex: "asc" },
    });
    for (const b of above) {
      await prisma.box.update({
        where: { id: b.id },
        data: { stackIndex: b.stackIndex - 1 },
      });
    }
  }
  return NextResponse.json({ ok: true });
}

async function compactStack(locationId: string, removedIndex: number) {
  const above = await prisma.box.findMany({
    where: { locationId, kind: "box", stackIndex: { gt: removedIndex } },
    orderBy: { stackIndex: "asc" },
  });
  for (const b of above) {
    await prisma.box.update({
      where: { id: b.id },
      data: { stackIndex: b.stackIndex - 1 },
    });
  }
}
