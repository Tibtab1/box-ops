import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

// GET /api/notifications — recent things the user should know about
// For v12 we keep it simple: list shares received in the last 24h where the
// user hasn't opened the corresponding place yet (proxy: share createdAt very
// recent). In future iterations we can store a proper "seen" flag.
export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);

  const recentShares = await prisma.placeShare.findMany({
    where: {
      userId,
      createdAt: { gte: dayAgo },
    },
    include: {
      place: {
        select: {
          id: true,
          name: true,
          owner: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    newShares: recentShares.map((s) => ({
      shareId: s.id,
      placeId: s.place.id,
      placeName: s.place.name,
      ownerName: s.place.owner.name ?? s.place.owner.email ?? "quelqu'un",
      role: s.role,
      receivedAt: s.createdAt.toISOString(),
    })),
  });
}
