import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlaceAccess } from "@/lib/require-place";
import { logMove } from "@/lib/moves";

export const dynamic = "force-dynamic";

// GET /api/undo — peek at the next available undo action (for UI label)
export async function GET() {
  const r = await requirePlaceAccess();
  if ("error" in r) return r.error;
  const { userId, placeId } = r.access;

  const entry = await prisma.undoEntry.findFirst({
    where: { userId, placeId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, kind: true, createdAt: true },
  });
  return NextResponse.json({
    available: !!entry,
    label: entry?.label ?? null,
    createdAt: entry?.createdAt?.toISOString() ?? null,
  });
}

// POST /api/undo — pop and execute the inverse of the last action
export async function POST() {
  const r = await requirePlaceAccess({ minRole: "editor" });
  if ("error" in r) return r.error;
  const { userId, placeId } = r.access;

  const entry = await prisma.undoEntry.findFirst({
    where: { userId, placeId },
    orderBy: { createdAt: "desc" },
  });
  if (!entry) {
    return NextResponse.json({ error: "Aucune action à annuler." }, { status: 404 });
  }

  // Dispatch based on kind
  try {
    if (entry.kind === "move_box") {
      await undoMove(entry.payload as {
        boxId: string;
        targetLocationId: string | null;
        targetStackIndex: number;
        previousCode: string | null;
      }, placeId);
    } else {
      return NextResponse.json({ error: "Type d'undo non supporté." }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur pendant l'annulation.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Consume the entry (don't keep redo history for now — keep v12 scope small)
  await prisma.undoEntry.delete({ where: { id: entry.id } });

  return NextResponse.json({ ok: true, label: entry.label });
}

async function undoMove(
  payload: {
    boxId: string;
    targetLocationId: string | null;
    targetStackIndex: number;
    previousCode: string | null;
  },
  placeId: string
) {
  const box = await prisma.box.findFirst({
    where: { id: payload.boxId, placeId },
  });
  if (!box) throw new Error("La boîte n'existe plus — impossible d'annuler.");

  const currentLocationId = box.locationId;
  const currentStackIndex = box.stackIndex;

  // Verify destination is still valid
  if (payload.targetLocationId) {
    const dest = await prisma.location.findFirst({
      where: { id: payload.targetLocationId, placeId },
      include: { boxes: true },
    });
    if (!dest) throw new Error("L'emplacement d'origine n'existe plus — impossible d'annuler.");
    if (dest.type !== "cell" || !dest.enabled) {
      throw new Error("L'emplacement d'origine n'est plus actif.");
    }
    // If it's full we can't put it back; user has to free space first
    const existingHere = dest.boxes.filter((b) => b.id !== box.id);
    if (existingHere.length >= dest.capacity) {
      throw new Error(`L'emplacement d'origine ${dest.code} est plein.`);
    }
    await prisma.box.update({
      where: { id: box.id },
      data: {
        locationId: dest.id,
        stackIndex: Math.min(payload.targetStackIndex, existingHere.length),
      },
    });
  } else {
    // Undo back to no-location state
    await prisma.box.update({
      where: { id: box.id },
      data: { locationId: null, stackIndex: 0 },
    });
  }

  // Compact the stack we just left
  if (currentLocationId && currentLocationId !== payload.targetLocationId) {
    const above = await prisma.box.findMany({
      where: { locationId: currentLocationId, stackIndex: { gt: currentStackIndex } },
      orderBy: { stackIndex: "asc" },
    });
    for (const b of above) {
      await prisma.box.update({
        where: { id: b.id },
        data: { stackIndex: b.stackIndex - 1 },
      });
    }
  }

  await logMove({
    boxId: box.id,
    fromCode: null, // we don't re-resolve the source code; log it as undo
    toCode: payload.previousCode,
    fromStackIndex: null,
    toStackIndex: payload.targetStackIndex,
    reason: "undo",
  });
}
