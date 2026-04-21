import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTags, serializeTags } from "@/lib/types";
import { logMove } from "@/lib/moves";
import { requireUserId } from "@/lib/require-user";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const box = await prisma.box.findFirst({
    where: { id: params.id, userId: auth.userId },
    include: { location: true },
  });
  if (!box) {
    return NextResponse.json({ error: "Boîte introuvable." }, { status: 404 });
  }

  let neighbors: Record<"left" | "right" | "front" | "back", unknown> = {
    left: null,
    right: null,
    front: null,
    back: null,
  };

  let stack: Array<{
    id: string;
    name: string;
    color: string;
    stackIndex: number;
    isSelf: boolean;
  }> = [];
  let capacity = 0;

  if (box.location) {
    const { row, col, id: locId, capacity: cap } = box.location;
    capacity = cap;

    const siblings = await prisma.box.findMany({
      where: { locationId: locId },
      orderBy: { stackIndex: "asc" },
    });
    stack = siblings.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      stackIndex: s.stackIndex,
      isSelf: s.id === box.id,
    }));

    const offsets: Array<{
      key: keyof typeof neighbors;
      dr: number;
      dc: number;
    }> = [
      { key: "left", dr: 0, dc: -1 },
      { key: "right", dr: 0, dc: 1 },
      { key: "back", dr: -1, dc: 0 },
      { key: "front", dr: 1, dc: 0 },
    ];

    for (const o of offsets) {
      const loc = await prisma.location.findFirst({
        where: {
          userId: auth.userId,
          row: row + o.dr,
          col: col + o.dc,
          type: "cell",
          enabled: true,
        },
        include: {
          boxes: { orderBy: { stackIndex: "desc" }, take: 1 },
        },
      });
      const top = loc?.boxes?.[0];
      if (top) {
        neighbors[o.key] = {
          id: top.id,
          name: top.name,
          color: top.color,
          tags: parseTags(top.tags),
          location: { code: loc!.code, row: loc!.row, col: loc!.col },
          stackSize: await prisma.box.count({ where: { locationId: loc!.id } }),
        };
      }
    }
  }

  return NextResponse.json({
    box: {
      ...box,
      tags: parseTags(box.tags),
      createdAt: box.createdAt.toISOString(),
      updatedAt: box.updatedAt.toISOString(),
    },
    neighbors,
    stack,
    capacity,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;
  const { userId } = auth;

  const body = await req.json();
  const box = await prisma.box.findFirst({
    where: { id: params.id, userId },
    include: { location: true },
  });
  if (!box) {
    return NextResponse.json({ error: "Boîte introuvable." }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.description === "string") data.description = body.description.trim();
  if (typeof body.color === "string") data.color = body.color;
  if (typeof body.photoUrl === "string" || body.photoUrl === null) {
    data.photoUrl = body.photoUrl;
  }
  if (Array.isArray(body.tags)) data.tags = serializeTags(body.tags);
  else if (typeof body.tags === "string") data.tags = body.tags;

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
        where: { userId_code: { userId, code: body.locationCode } },
        include: { boxes: true },
      });
      if (!dest) {
        return NextResponse.json(
          { error: `Emplacement ${body.locationCode} introuvable.` },
          { status: 400 }
        );
      }
      if (dest.type !== "cell" || !dest.enabled) {
        return NextResponse.json(
          { error: `${body.locationCode} n'est pas un emplacement actif.` },
          { status: 400 }
        );
      }
      if (dest.id === oldLocationId) {
        // no move
      } else {
        const stackSize = dest.boxes.length;
        if (stackSize >= dest.capacity) {
          return NextResponse.json(
            { error: `L'emplacement ${body.locationCode} est plein (${dest.capacity} max).` },
            { status: 409 }
          );
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
        fromCode: oldCode,
        toCode: newCode,
        fromStackIndex: oldCode ? oldStackIndex : null,
        toStackIndex: newStackIndex,
        reason: newCode ? "move" : "detach",
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
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const box = await prisma.box.findFirst({
    where: { id: params.id, userId: auth.userId },
  });
  if (!box) return NextResponse.json({ ok: true });

  await prisma.box.delete({ where: { id: params.id } });

  if (box.locationId) {
    await compactStack(box.locationId, box.stackIndex);
  }
  return NextResponse.json({ ok: true });
}

async function compactStack(locationId: string, removedIndex: number) {
  const above = await prisma.box.findMany({
    where: { locationId, stackIndex: { gt: removedIndex } },
    orderBy: { stackIndex: "asc" },
  });
  for (const b of above) {
    await prisma.box.update({
      where: { id: b.id },
      data: { stackIndex: b.stackIndex - 1 },
    });
  }
}
