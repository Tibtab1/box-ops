import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

// GET /api/invitations/token/[token] — show info about an invite link
// (used to render the /invite/[token] landing page)
// No auth required: an unauthenticated visitor needs to see what they're
// about to accept before signing up or in.
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const invite = await prisma.placeInvitation.findUnique({
    where: { token: params.token },
    include: {
      place: { select: { id: true, name: true, ownerId: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });
  if (!invite || invite.kind !== "link") {
    return NextResponse.json({ error: "Invitation invalide." }, { status: 404 });
  }

  // Expiry check
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invitation expirée.", expired: true }, { status: 410 });
  }
  // Uses check
  if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
    return NextResponse.json({ error: "Invitation déjà utilisée.", consumed: true }, { status: 410 });
  }

  return NextResponse.json({
    placeName: invite.place.name,
    invitedBy:
      invite.createdBy.name ?? invite.createdBy.email ?? "un utilisateur",
    role: invite.role,
    maxUses: invite.maxUses,
    usedCount: invite.usedCount,
    remaining:
      invite.maxUses !== null ? invite.maxUses - invite.usedCount : null,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
  });
}

// POST /api/invitations/token/[token] — accept (current user must be signed in)
export async function POST(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json(
      { error: "Vous devez être connecté pour accepter l'invitation." },
      { status: 401 }
    );
  }

  const invite = await prisma.placeInvitation.findUnique({
    where: { token: params.token },
  });
  if (!invite || invite.kind !== "link") {
    return NextResponse.json({ error: "Invitation invalide." }, { status: 404 });
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invitation expirée." }, { status: 410 });
  }
  if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
    return NextResponse.json({ error: "Invitation déjà utilisée." }, { status: 410 });
  }

  const place = await prisma.place.findUnique({
    where: { id: invite.placeId },
    select: { id: true, ownerId: true, name: true },
  });
  if (!place) {
    return NextResponse.json({ error: "Lieu introuvable." }, { status: 404 });
  }
  if (place.ownerId === userId) {
    return NextResponse.json(
      { error: "Vous êtes déjà propriétaire de ce lieu." },
      { status: 400 }
    );
  }

  const existing = await prisma.placeShare.findUnique({
    where: { placeId_userId: { placeId: place.id, userId } },
  });
  if (existing) {
    // Already a member. Silently succeed and report the placeId so the
    // client can redirect them.
    // Consume the link if single-use though? No — we don't burn a use for noop.
    return NextResponse.json({
      ok: true, placeId: place.id, placeName: place.name, alreadyMember: true,
    });
  }

  // Create the share. Use a transaction to also consume the invite atomically.
  await prisma.$transaction([
    prisma.placeShare.create({
      data: { placeId: place.id, userId, role: invite.role },
    }),
    ...(invite.maxUses !== null && invite.usedCount + 1 >= invite.maxUses
      ? [prisma.placeInvitation.delete({ where: { id: invite.id } })]
      : [
          prisma.placeInvitation.update({
            where: { id: invite.id },
            data: { usedCount: invite.usedCount + 1 },
          }),
        ]),
  ]);

  return NextResponse.json({
    ok: true, placeId: place.id, placeName: place.name,
  });
}
