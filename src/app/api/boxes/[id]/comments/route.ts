import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlaceAccess } from "@/lib/require-place";

export const dynamic = "force-dynamic";

// GET /api/boxes/[id]/comments
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
  if (!box) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const comments = await prisma.comment.findMany({
    where: { boxId: params.id },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    comments.map((c) => ({
      id: c.id,
      text: c.text,
      userName: c.user.name ?? c.user.email?.split("@")[0] ?? "?",
      createdAt: c.createdAt.toISOString(),
    }))
  );
}

// POST /api/boxes/[id]/comments
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const r = await requirePlaceAccess();
  if ("error" in r) return r.error;
  const { placeId, userId } = r.access;

  if (r.access.role === "viewer") {
    return NextResponse.json({ error: "Lecture seule" }, { status: 403 });
  }

  const box = await prisma.box.findFirst({
    where: { id: params.id, placeId },
    select: { id: true },
  });
  if (!box) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const body = await req.json();
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Texte vide" }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: "Trop long (max 1000 car.)" }, { status: 400 });

  const comment = await prisma.comment.create({
    data: { boxId: params.id, userId, text },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json({
    id: comment.id,
    text: comment.text,
    userName: comment.user.name ?? comment.user.email?.split("@")[0] ?? "?",
    createdAt: comment.createdAt.toISOString(),
  });
}

// DELETE /api/boxes/[id]/comments?commentId=xxx  (own comment only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const r = await requirePlaceAccess();
  if ("error" in r) return r.error;
  const { placeId, userId } = r.access;

  const commentId = new URL(req.url).searchParams.get("commentId");
  if (!commentId) return NextResponse.json({ error: "commentId manquant" }, { status: 400 });

  // Verify box belongs to this place
  const box = await prisma.box.findFirst({
    where: { id: params.id, placeId },
    select: { id: true },
  });
  if (!box) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const comment = await prisma.comment.findFirst({
    where: { id: commentId, boxId: params.id },
  });
  if (!comment) return NextResponse.json({ error: "Commentaire introuvable" }, { status: 404 });

  // Only owner of the comment (or place owner/admin) can delete
  const isOwner = comment.userId === userId;
  const isAdmin = r.access.role === "owner" || r.access.role === "admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  await prisma.comment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
