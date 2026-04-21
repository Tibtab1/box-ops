import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

// Helpers: only owner or admin of the place can manage shares
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
      error: NextResponse.json(
        { error: "Seul le propriétaire ou un admin peut gérer les partages." },
        { status: 403 }
      ),
    };
  }
  return { place, userId, isOwner };
}

// GET /api/places/[id]/shares — list active members + pending invitations
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await getPlaceIfManager(params.id);
  if ("error" in result) return result.error;

  const [shares, invitations] = await Promise.all([
    prisma.placeShare.findMany({
      where: { placeId: params.id },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.placeInvitation.findMany({
      where: { placeId: params.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    owner: {
      id: result.place.ownerId,
    },
    shares: shares.map((s) => ({
      id: s.id,
      userId: s.userId,
      name: s.user.name,
      email: s.user.email,
      image: s.user.image,
      role: s.role,
      createdAt: s.createdAt.toISOString(),
    })),
    invitations: invitations.map((i) => ({
      id: i.id,
      kind: i.kind,
      role: i.role,
      email: i.email,
      token: i.token,
      maxUses: i.maxUses,
      usedCount: i.usedCount,
      expiresAt: i.expiresAt?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
    })),
  });
}
