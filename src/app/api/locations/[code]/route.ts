import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlaceAccess } from "@/lib/require-place";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  // Modifying a cell (type, capacity, enabled) is an admin-level action
  const r = await requirePlaceAccess({ minRole: "admin" });
  if ("error" in r) return r.error;
  const { placeId } = r.access;

  const body = await req.json();
  const loc = await prisma.location.findUnique({
    where: { placeId_code: { placeId, code: params.code } },
    include: { boxes: true },
  });
  if (!loc) {
    return NextResponse.json(
      { error: `Emplacement ${params.code} introuvable.` },
      { status: 404 }
    );
  }

  const data: Record<string, unknown> = {};

  if (typeof body.type === "string") {
    if (!["cell", "aisle", "wall"].includes(body.type)) {
      return NextResponse.json({ error: "Type invalide." }, { status: 400 });
    }
    if (body.type !== "cell" && loc.boxes.length > 0) {
      return NextResponse.json(
        { error: `Impossible de changer le type : ${loc.boxes.length} boîte(s) présente(s).` },
        { status: 409 }
      );
    }
    data.type = body.type;
  }

  if (typeof body.capacity === "number") {
    if (body.capacity < 1 || body.capacity > 99) {
      return NextResponse.json(
        { error: "La capacité doit être entre 1 et 99." },
        { status: 400 }
      );
    }
    if (body.capacity < loc.boxes.length) {
      return NextResponse.json(
        { error: `Capacité trop basse : ${loc.boxes.length} boîte(s) déjà empilée(s).` },
        { status: 409 }
      );
    }
    data.capacity = body.capacity;
  }

  if (typeof body.enabled === "boolean") {
    if (!body.enabled && loc.boxes.length > 0) {
      return NextResponse.json(
        { error: `Impossible de désactiver : ${loc.boxes.length} boîte(s) présente(s).` },
        { status: 409 }
      );
    }
    data.enabled = body.enabled;
  }

  const updated = await prisma.location.update({
    where: { id: loc.id },
    data,
  });

  return NextResponse.json(updated);
}
