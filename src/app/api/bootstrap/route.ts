import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

// POST /api/bootstrap — if the current user owns NO place yet, create a
// default place "Mon premier lieu" with a starter 3×4 plan.
export async function POST() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const ownedCount = await prisma.place.count({ where: { ownerId: userId } });
  if (ownedCount > 0) {
    return NextResponse.json({ ok: true, created: false });
  }

  const place = await prisma.place.create({
    data: { name: "Mon premier lieu", ownerId: userId },
  });

  const ROWS = 3;
  const COLS = 4;
  for (let r = 1; r <= ROWS; r++) {
    const aisle = `R${r}`;
    for (let c = 0; c < COLS; c++) {
      await prisma.location.create({
        data: {
          placeId: place.id, userId,
          code: `${aisle}-${c + 1}`,
          aisle, slot: c + 1,
          row: r, col: c,
          type: "cell", capacity: 20, enabled: true,
        },
      });
    }
  }

  return NextResponse.json({
    ok: true, created: true, placeId: place.id,
  });
}
