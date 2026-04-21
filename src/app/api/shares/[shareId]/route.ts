import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

async function getShareIfManager(shareId: string) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return { error: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };
  }
  const share = await prisma.placeShare.findUnique({
    where: { id: shareId },
    include: {
      place: {
        include: { shares: { where: { userId } } },
      },
    },
  });
  if (!share) {
    return { error: NextResponse.json({ error: "Partage introuvable." }, { status: 404 }) };
  }
  const isOwner = share.place.ownerId === userId;
  const isAdmin = share.place.shares.length > 0 && share.place.shares[0].role === "admin";
  // A user can also remove THEIR OWN share (leaving a shared place)
  const isSelf = share.userId === userId;
  if (!isOwner && !isAdmin && !isSelf) {
    return {
      error: NextResponse.json({ error: "Droits insuffisants." }, { status: 403 }),
    };
  }
  return { share, userId, isOwner, isAdmin, isSelf };
}

// PATCH — change role of an existing member
export async function PATCH(
  req: NextRequest,
  { params }: { params: { shareId: string } }
) {
  const result = await getShareIfManager(params.shareId);
  if ("error" in result) return result.error;
  const { share, isOwner, isAdmin } = result;

  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { error: "Seul un owner/admin peut changer les rôles." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const role = body?.role;
  if (!["viewer", "editor", "admin"].includes(role)) {
    return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
  }
  // Only owner can promote to admin
  if (role === "admin" && !isOwner) {
    return NextResponse.json(
      { error: "Seul le propriétaire peut promouvoir un utilisateur en admin." },
      { status: 403 }
    );
  }

  const updated = await prisma.placeShare.update({
    where: { id: share.id },
    data: { role },
  });
  return NextResponse.json({ ok: true, role: updated.role });
}

// DELETE — remove a member (or leave a shared place)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { shareId: string } }
) {
  const result = await getShareIfManager(params.shareId);
  if ("error" in result) return result.error;

  await prisma.placeShare.delete({ where: { id: result.share.id } });
  return NextResponse.json({ ok: true });
}
