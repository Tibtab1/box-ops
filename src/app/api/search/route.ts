import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTags } from "@/lib/types";
import { requirePlaceAccess } from "@/lib/require-place";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const r = await requirePlaceAccess();
  if ("error" in r) return r.error;
  const { placeId } = r.access;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json([]);

  const all = await prisma.box.findMany({
    where: { placeId },
    include: { location: true },
  });
  const needle = q.toLowerCase();
  const matches = all.filter((b) => {
    const hay = [b.name, b.description ?? "", b.tags, b.location?.code ?? ""]
      .join(" ").toLowerCase();
    return hay.includes(needle);
  });

  return NextResponse.json(
    matches.map((b) => ({
      id: b.id,
      name: b.name, description: b.description,
      tags: parseTags(b.tags),
      color: b.color, photoUrl: b.photoUrl,
      locationId: b.locationId, stackIndex: b.stackIndex,
      location: b.location,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }))
  );
}
