import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

// DELETE /api/invitations/[id] — revoke a pending invitation
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const invite = await prisma.placeInvitation.findUnique({
    where: { id: params.id },
    include: {
      place: {
        include: { shares: { where: { userId } } },
      },
    },
  });
  if (!invite) {
    return NextResponse.json({ ok: true });
  }
  const isOwner = invite.place.ownerId === userId;
  const isAdmin =
    invite.place.shares.length > 0 && invite.place.shares[0].role === "admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }

  await prisma.placeInvitation.delete({ where: { id: invite.id } });
  return NextResponse.json({ ok: true });
}
