import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ACTIVE_PLACE_COOKIE } from "@/lib/require-place";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  // Read the cookie from the request
  const raw = (await (await import("next/headers")).cookies()).get(ACTIVE_PLACE_COOKIE);
  return NextResponse.json({ placeId: raw?.value ?? null });
}

// POST /api/places/active { placeId } — switches the active place
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { placeId } = (await req.json().catch(() => ({}))) as {
    placeId?: string;
  };
  if (!placeId) {
    return NextResponse.json({ error: "placeId manquant." }, { status: 400 });
  }

  // Verify the user has access to this place
  const place = await prisma.place.findFirst({
    where: {
      id: placeId,
      OR: [{ ownerId: userId }, { shares: { some: { userId } } }],
    },
    select: { id: true },
  });
  if (!place) {
    return NextResponse.json({ error: "Lieu introuvable ou sans accès." }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true, placeId: place.id });
  res.cookies.set(ACTIVE_PLACE_COOKIE, place.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return res;
}
