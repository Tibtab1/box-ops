import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateInviteToken } from "@/lib/invite-token";

export const dynamic = "force-dynamic";

async function getPlaceIfManager(id: string) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return { error: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };
  }
  const place = await prisma.place.findUnique({
    where: { id },
    include: { shares: { where: { userId } } },
  });
  if (!place) {
    return { error: NextResponse.json({ error: "Lieu introuvable." }, { status: 404 }) };
  }
  const isOwner = place.ownerId === userId;
  const isAdmin = place.shares.length > 0 && place.shares[0].role === "admin";
  if (!isOwner && !isAdmin) {
    return {
      error: NextResponse.json({ error: "Droits insuffisants." }, { status: 403 }),
    };
  }
  return { place, userId };
}

// POST /api/places/[id]/invitations
// Body (email flavor):
//   { kind: "email", email: "x@y.com", role: "viewer" | "editor" | "admin" }
// Body (link flavor):
//   { kind: "link", role: "...", maxUses: number|null, expiresDays: number|null }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await getPlaceIfManager(params.id);
  if ("error" in result) return result.error;
  const { place, userId } = result;

  const body = await req.json().catch(() => null);
  const kind = body?.kind;
  const role = body?.role ?? "viewer";

  if (!["viewer", "editor", "admin"].includes(role)) {
    return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
  }

  // Only the owner can create admin invitations (prevent admin privilege escalation)
  if (role === "admin" && place.ownerId !== userId) {
    return NextResponse.json(
      { error: "Seul le propriétaire peut créer une invitation avec le rôle admin." },
      { status: 403 }
    );
  }

  if (kind === "email") {
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalide." }, { status: 400 });
    }
    // If a user with that email already exists → convert to direct share
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      if (existingUser.id === place.ownerId) {
        return NextResponse.json(
          { error: "Cet utilisateur est déjà propriétaire de ce lieu." },
          { status: 400 }
        );
      }
      const existingShare = await prisma.placeShare.findUnique({
        where: { placeId_userId: { placeId: place.id, userId: existingUser.id } },
      });
      if (existingShare) {
        return NextResponse.json(
          { error: "Cette personne a déjà accès à ce lieu." },
          { status: 409 }
        );
      }
      await prisma.placeShare.create({
        data: { placeId: place.id, userId: existingUser.id, role },
      });
      return NextResponse.json({
        ok: true,
        immediate: true,
        user: { email: existingUser.email, name: existingUser.name },
      });
    }
    // Otherwise, store a pending invitation that will auto-claim at their sign-up
    const existingPending = await prisma.placeInvitation.findFirst({
      where: { placeId: place.id, kind: "email", email },
    });
    if (existingPending) {
      return NextResponse.json(
        { error: "Une invitation est déjà en attente pour cet email." },
        { status: 409 }
      );
    }
    await prisma.placeInvitation.create({
      data: {
        placeId: place.id,
        createdById: userId,
        kind: "email",
        role,
        email,
      },
    });
    return NextResponse.json({ ok: true, immediate: false, email });
  }

  if (kind === "link") {
    // Validate maxUses and expiresDays
    let maxUses: number | null = null;
    if (body?.maxUses === null || body?.maxUses === undefined) {
      maxUses = null; // unlimited
    } else if (typeof body.maxUses === "number" && body.maxUses > 0 && body.maxUses <= 100) {
      maxUses = body.maxUses;
    } else {
      return NextResponse.json(
        { error: "maxUses doit être null ou un entier entre 1 et 100." },
        { status: 400 }
      );
    }

    let expiresAt: Date | null = null;
    if (body?.expiresDays === null || body?.expiresDays === undefined) {
      expiresAt = null;
    } else if (
      typeof body.expiresDays === "number" &&
      body.expiresDays > 0 &&
      body.expiresDays <= 365
    ) {
      expiresAt = new Date(Date.now() + body.expiresDays * 24 * 3600 * 1000);
    } else {
      return NextResponse.json(
        { error: "expiresDays doit être null ou un entier entre 1 et 365." },
        { status: 400 }
      );
    }

    const token = generateInviteToken();
    const invite = await prisma.placeInvitation.create({
      data: {
        placeId: place.id,
        createdById: userId,
        kind: "link",
        role,
        token,
        maxUses,
        expiresAt,
      },
    });
    return NextResponse.json({ ok: true, token, inviteId: invite.id });
  }

  return NextResponse.json(
    { error: "Type d'invitation inconnu (attendu: email ou link)." },
    { status: 400 }
  );
}
