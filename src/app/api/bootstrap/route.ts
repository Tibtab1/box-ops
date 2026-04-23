import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

// POST /api/bootstrap
//
// Previously: would auto-create a default "Mon premier lieu" with a 3×4 grid
// the first time an authenticated user visited the app.
//
// v13+: we no longer create anything automatically. The user now goes through
// an onboarding flow where they explicitly choose a starter preset (or start
// empty). This endpoint now just reports whether the user already owns any
// place — the client uses that to decide whether to show the main app or
// redirect to /onboarding.
export async function POST() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const ownedCount = await prisma.place.count({ where: { ownerId: userId } });
  // Also count places the user has been invited to
  const sharedCount = await prisma.placeShare.count({ where: { userId } });

  const hasPlaces = ownedCount + sharedCount > 0;

  return NextResponse.json({
    ok: true,
    hasPlaces,
    ownedCount,
    sharedCount,
  });
}
