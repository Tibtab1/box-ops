// Central helper for place-scoped API routes.
// Resolves the active place from a cookie, verifies access, and returns
// both userId and placeId in a single call.
//
// A user "has access" to a Place if they own it OR have a PlaceShare on it.
// The returned `role` tells the caller which role the current user has:
//   - "owner"  : full rights
//   - "admin"  : can manage the plan AND shares (but can't delete the place)
//   - "editor" : can add/modify/move boxes
//   - "viewer" : read-only
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const ACTIVE_PLACE_COOKIE = "boxops-active-place";

export type PlaceAccess = {
  userId: string;
  placeId: string;
  role: "owner" | "admin" | "editor" | "viewer";
};

export async function requirePlaceAccess(
  options: { minRole?: "viewer" | "editor" | "admin" } = {}
): Promise<{ access: PlaceAccess } | { error: NextResponse }> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return { error: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };
  }

  const cookieStore = cookies();
  let placeId = cookieStore.get(ACTIVE_PLACE_COOKIE)?.value ?? null;

  // No active place in cookie → fall back to the user's first owned place
  if (!placeId) {
    const first = await prisma.place.findFirst({
      where: {
        OR: [
          { ownerId: userId },
          { shares: { some: { userId } } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });
    placeId = first?.id ?? null;
  }

  if (!placeId) {
    return {
      error: NextResponse.json(
        { error: "Aucun lieu actif. Créez-en un d'abord." },
        { status: 409 }
      ),
    };
  }

  // Verify access
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    include: {
      shares: { where: { userId } },
    },
  });
  if (!place) {
    return {
      error: NextResponse.json({ error: "Lieu introuvable." }, { status: 404 }),
    };
  }

  let role: PlaceAccess["role"];
  if (place.ownerId === userId) {
    role = "owner";
  } else if (place.shares.length > 0) {
    role = place.shares[0].role as PlaceAccess["role"];
  } else {
    return {
      error: NextResponse.json({ error: "Accès refusé à ce lieu." }, { status: 403 }),
    };
  }

  // Minimum-role check
  if (options.minRole) {
    const rank: Record<string, number> = {
      viewer: 1,
      editor: 2,
      admin: 3,
      owner: 4,
    };
    if (rank[role] < rank[options.minRole]) {
      return {
        error: NextResponse.json(
          { error: `Droits insuffisants (rôle requis : ${options.minRole}).` },
          { status: 403 }
        ),
      };
    }
  }

  return { access: { userId, placeId, role } };
}
