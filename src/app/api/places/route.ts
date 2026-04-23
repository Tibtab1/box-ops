import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createStarterPlan } from "@/lib/create-starter-plan";
import { findPreset, EMPTY_PRESET_ID } from "@/lib/plan-presets";

export const dynamic = "force-dynamic";

// GET /api/places — all places accessible to the current user
export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const places = await prisma.place.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { shares: { some: { userId } } },
      ],
    },
    include: {
      shares: { where: { userId } },
      _count: { select: { locations: true, boxes: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    places.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      isOwner: p.ownerId === userId,
      role:
        p.ownerId === userId ? "owner" : (p.shares[0]?.role ?? "viewer"),
      locationsCount: p._count.locations,
      boxesCount: p._count.boxes,
      createdAt: p.createdAt.toISOString(),
    }))
  );
}

// POST /api/places — create a new place owned by the current user
// Body: { name: string, description?: string, preset?: "closet" | "cellar" | ... | "empty" }
// If preset is provided (and not "empty"), a starter plan is created.
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description =
    typeof body?.description === "string" ? body.description.trim() : null;
  const presetId =
    typeof body?.preset === "string" ? body.preset : EMPTY_PRESET_ID;

  if (!name) {
    return NextResponse.json(
      { error: "Le nom du lieu est obligatoire." },
      { status: 400 }
    );
  }
  if (name.length > 80) {
    return NextResponse.json(
      { error: "Nom trop long (80 caractères max)." },
      { status: 400 }
    );
  }

  const place = await prisma.place.create({
    data: { name, description, ownerId: userId },
  });

  let cellsCreated = 0;
  if (presetId !== EMPTY_PRESET_ID) {
    const preset = findPreset(presetId);
    if (preset) {
      cellsCreated = await createStarterPlan({
        placeId: place.id,
        userId,
        rows: preset.rows,
        cols: preset.cols,
      });
    }
  }

  return NextResponse.json(
    {
      id: place.id,
      name: place.name,
      preset: presetId,
      cellsCreated,
    },
    { status: 201 }
  );
}
