import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";

export const dynamic = "force-dynamic";

// POST /api/bootstrap — if the current user has no locations yet, create a
// small starter plan. Idempotent: does nothing if the user already has cells.
export async function POST() {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;
  const { userId } = auth;

  const existing = await prisma.location.count({ where: { userId } });
  if (existing > 0) {
    return NextResponse.json({ ok: true, created: false });
  }

  // Starter: 3 rows of 4 cells
  const ROWS = 3;
  const COLS = 4;
  for (let r = 1; r <= ROWS; r++) {
    const aisle = `R${r}`;
    for (let c = 0; c < COLS; c++) {
      await prisma.location.create({
        data: {
          userId,
          code: `${aisle}-${c + 1}`,
          aisle,
          slot: c + 1,
          row: r,
          col: c,
          type: "cell",
          capacity: 5,
          enabled: true,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, created: true, rows: ROWS, cols: COLS });
}
