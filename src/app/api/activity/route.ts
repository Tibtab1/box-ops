import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlaceAccess } from "@/lib/require-place";

export const dynamic = "force-dynamic";

// GET /api/activity — returns last 50 moves + plan changes for the active place
export async function GET() {
  const r = await requirePlaceAccess();
  if ("error" in r) return r.error;
  const { placeId } = r.access;

  const [moves, planLogs] = await Promise.all([
    prisma.move.findMany({
      where: { box: { placeId } },
      include: { box: { select: { name: true, color: true, kind: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.planLog.findMany({
      where: { placeId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  type Event =
    | {
        kind: "move";
        id: string;
        boxName: string;
        boxColor: string;
        boxKind: string;
        fromCode: string | null;
        toCode: string | null;
        reason: string;
        createdAt: string;
      }
    | {
        kind: "plan";
        id: string;
        action: string;
        detail: unknown;
        userName: string;
        createdAt: string;
      };

  const events: Event[] = [
    ...moves.map((m) => ({
      kind: "move" as const,
      id: m.id,
      boxName: m.box.name,
      boxColor: m.box.color,
      boxKind: m.box.kind,
      fromCode: m.fromCode,
      toCode: m.toCode,
      reason: m.reason,
      createdAt: m.createdAt.toISOString(),
    })),
    ...planLogs.map((l) => ({
      kind: "plan" as const,
      id: l.id,
      action: l.action,
      detail: l.detail,
      userName: l.user.name ?? l.user.email ?? "?",
      createdAt: l.createdAt.toISOString(),
    })),
  ];

  events.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json(events.slice(0, 50));
}
