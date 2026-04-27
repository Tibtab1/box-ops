import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";

export const dynamic = "force-dynamic";

// DELETE /api/account — permanently delete the authenticated user and all their data
export async function DELETE() {
  const r = await requireUserId();
  if ("error" in r) return r.error;
  const { userId } = r;

  // Cascade in Prisma schema handles: Sessions, Accounts, Boxes, Locations,
  // Places (owned), PlaceShares, PlanLogs, Comments, UndoEntries, PasswordResetTokens.
  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ ok: true });
}
