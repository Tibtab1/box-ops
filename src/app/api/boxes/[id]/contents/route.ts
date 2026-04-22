import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTags } from "@/lib/types";
import { requirePlaceAccess } from "@/lib/require-place";

export const dynamic = "force-dynamic";

// GET /api/boxes/[id]/contents — list the child boxes of a furniture item
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const r = await requirePlaceAccess();
  if ("error" in r) return r.error;
  const { placeId } = r.access;

  const parent = await prisma.box.findFirst({
    where: { id: params.id, placeId, kind: "furniture" },
  });
  if (!parent) {
    return NextResponse.json({ error: "Meuble introuvable." }, { status: 404 });
  }

  const children = await prisma.box.findMany({
    where: { parentId: parent.id },
    orderBy: { stackIndex: "asc" },
  });

  return NextResponse.json({
    parent: {
      id: parent.id,
      name: parent.name,
      color: parent.color,
      tags: parseTags(parent.tags),
      spanW: parent.spanW,
      spanH: parent.spanH,
    },
    children: children.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      color: c.color,
      tags: parseTags(c.tags),
      photoUrl: c.photoUrl,
      stackIndex: c.stackIndex,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}

// POST /api/boxes/[id]/contents — reorder children (swap up/down)
// Body: { childId: string, action: "up" | "down" }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const r = await requirePlaceAccess({ minRole: "editor" });
  if ("error" in r) return r.error;
  const { placeId } = r.access;

  const parent = await prisma.box.findFirst({
    where: { id: params.id, placeId, kind: "furniture" },
  });
  if (!parent) {
    return NextResponse.json({ error: "Meuble introuvable." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const childId = body?.childId;
  const action = body?.action;
  if (typeof childId !== "string" || (action !== "up" && action !== "down")) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const children = await prisma.box.findMany({
    where: { parentId: parent.id },
    orderBy: { stackIndex: "asc" },
  });
  const idx = children.findIndex((c) => c.id === childId);
  if (idx === -1) {
    return NextResponse.json({ error: "Élément introuvable." }, { status: 404 });
  }
  const swapWith = action === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= children.length) {
    return NextResponse.json({ ok: true, noop: true });
  }
  const a = children[idx];
  const b = children[swapWith];
  // Swap stackIndex via a temporary value to avoid unique constraint issues if any
  await prisma.$transaction([
    prisma.box.update({ where: { id: a.id }, data: { stackIndex: -1 } }),
    prisma.box.update({ where: { id: b.id }, data: { stackIndex: a.stackIndex } }),
    prisma.box.update({ where: { id: a.id }, data: { stackIndex: b.stackIndex } }),
  ]);
  return NextResponse.json({ ok: true });
}
