// Record a reversible action. The payload contains the INVERSE operation.
// We keep the last 20 per user+place to bound storage.
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const MAX_ENTRIES_PER_USER_PLACE = 20;

export async function pushUndoEntry(args: {
  userId: string;
  placeId: string;
  kind: string;
  payload: Record<string, unknown>;
  label: string;
}): Promise<void> {
  await prisma.undoEntry.create({
    data: {
      userId: args.userId,
      placeId: args.placeId,
      kind: args.kind,
      payload: args.payload as Prisma.InputJsonValue,
      label: args.label,
    },
  });

  // Prune: keep only the most recent N
  const old = await prisma.undoEntry.findMany({
    where: { userId: args.userId, placeId: args.placeId },
    orderBy: { createdAt: "desc" },
    skip: MAX_ENTRIES_PER_USER_PLACE,
    select: { id: true },
  });
  if (old.length > 0) {
    await prisma.undoEntry.deleteMany({
      where: { id: { in: old.map((e) => e.id) } },
    });
  }
}
