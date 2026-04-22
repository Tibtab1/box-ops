import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlaceAccess } from "@/lib/require-place";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // All plan mutations require admin rights
  const r = await requirePlaceAccess({ minRole: "admin" });
  if ("error" in r) return r.error;
  const { placeId, userId } = r.access;

  const body = await req.json();
  const action = body.action as string;

  switch (action) {
    case "add_cell_right":
      return addCellRight(placeId, userId, body);
    case "add_cell_left":
      return addCellLeft(placeId, userId, body);
    case "remove_cell_right":
      return removeCellRight(placeId, body);
    case "remove_cell_left":
      return removeCellLeft(placeId, body);
    case "add_row":
      return addRow(placeId, userId, body);
    case "remove_row":
      return removeRow(placeId, body);
    case "reset":
      return resetPlan(placeId, userId, body);
    default:
      return NextResponse.json(
        { error: `Action inconnue : ${action}` },
        { status: 400 }
      );
  }
}

async function rowInfo(placeId: string, row: number) {
  const cells = await prisma.location.findMany({
    where: { placeId, row },
    orderBy: { col: "asc" },
  });
  if (cells.length === 0) return null;
  return {
    cells,
    minCol: cells[0].col,
    maxCol: cells[cells.length - 1].col,
    aisle: cells[0].aisle,
  };
}

async function nextFreeSlot(placeId: string, aisle: string): Promise<number> {
  const existing = await prisma.location.findMany({
    where: { placeId, aisle },
    select: { slot: true },
  });
  const used = new Set(existing.map((e) => e.slot));
  let s = 1;
  while (used.has(s)) s++;
  return s;
}

async function addCellRight(
  placeId: string,
  userId: string,
  body: { row: number; type?: string }
) {
  const info = await rowInfo(placeId, body.row);
  if (!info) return NextResponse.json({ error: "Rangée inexistante." }, { status: 404 });
  const type = body.type === "aisle" ? "aisle" : "cell";
  const slot = await nextFreeSlot(placeId, info.aisle);
  await prisma.location.create({
    data: {
      placeId, userId,
      code: `${info.aisle}-${slot}`,
      aisle: info.aisle, slot,
      row: body.row, col: info.maxCol + 1,
      type, capacity: 20, enabled: true,
    },
  });
  return NextResponse.json({ ok: true });
}

async function addCellLeft(
  placeId: string,
  userId: string,
  body: { row: number; type?: string }
) {
  const info = await rowInfo(placeId, body.row);
  if (!info) return NextResponse.json({ error: "Rangée inexistante." }, { status: 404 });
  const type = body.type === "aisle" ? "aisle" : "cell";

  if (info.minCol > 0) {
    const slot = await nextFreeSlot(placeId, info.aisle);
    await prisma.location.create({
      data: {
        placeId, userId,
        code: `${info.aisle}-${slot}`,
        aisle: info.aisle, slot,
        row: body.row, col: info.minCol - 1,
        type, capacity: 20, enabled: true,
      },
    });
    return NextResponse.json({ ok: true });
  }

  // Shift all cells of THIS place to the right by 1
  const allCells = await prisma.location.findMany({
    where: { placeId },
    orderBy: { col: "desc" },
  });
  for (const c of allCells) {
    await prisma.location.update({
      where: { id: c.id },
      data: { col: c.col + 1 },
    });
  }
  const slot = await nextFreeSlot(placeId, info.aisle);
  await prisma.location.create({
    data: {
      placeId, userId,
      code: `${info.aisle}-${slot}`,
      aisle: info.aisle, slot,
      row: body.row, col: 0,
      type, capacity: 20, enabled: true,
    },
  });
  return NextResponse.json({ ok: true, shifted: true });
}

async function removeCellRight(placeId: string, body: { row: number }) {
  const info = await rowInfo(placeId, body.row);
  if (!info) return NextResponse.json({ error: "Rangée inexistante." }, { status: 404 });
  if (info.cells.length <= 1) {
    return NextResponse.json({ error: "Une rangée doit avoir au moins une cellule." }, { status: 400 });
  }
  const last = info.cells[info.cells.length - 1];
  const boxCount = await prisma.box.count({ where: { locationId: last.id } });
  if (boxCount > 0) {
    return NextResponse.json({ error: `${boxCount} boîte(s) sur ${last.code}.` }, { status: 409 });
  }
  await prisma.location.delete({ where: { id: last.id } });
  return NextResponse.json({ ok: true });
}

async function removeCellLeft(placeId: string, body: { row: number }) {
  const info = await rowInfo(placeId, body.row);
  if (!info) return NextResponse.json({ error: "Rangée inexistante." }, { status: 404 });
  if (info.cells.length <= 1) {
    return NextResponse.json({ error: "Une rangée doit avoir au moins une cellule." }, { status: 400 });
  }
  const first = info.cells[0];
  const boxCount = await prisma.box.count({ where: { locationId: first.id } });
  if (boxCount > 0) {
    return NextResponse.json({ error: `${boxCount} boîte(s) sur ${first.code}.` }, { status: 409 });
  }
  await prisma.location.delete({ where: { id: first.id } });
  return NextResponse.json({ ok: true });
}

async function addRow(
  placeId: string,
  userId: string,
  body: { cells?: number; startCol?: number }
) {
  const cells = Math.max(1, Math.min(30, body.cells ?? 4));
  const startCol = Math.max(0, body.startCol ?? 0);

  const existing = await prisma.location.findMany({
    where: { placeId },
    select: { row: true },
  });
  const maxRow = existing.length ? Math.max(...existing.map((l) => l.row)) : 0;
  const newRow = maxRow + 1;
  const aisle = `R${newRow}`;

  for (let i = 0; i < cells; i++) {
    await prisma.location.create({
      data: {
        placeId, userId,
        code: `${aisle}-${i + 1}`,
        aisle, slot: i + 1,
        row: newRow, col: startCol + i,
        type: "cell", capacity: 20, enabled: true,
      },
    });
  }
  return NextResponse.json({ ok: true, row: newRow, aisle });
}

async function removeRow(placeId: string, body: { row: number }) {
  if (typeof body.row !== "number") {
    return NextResponse.json({ error: "row manquant." }, { status: 400 });
  }
  const inRow = await prisma.location.findMany({
    where: { placeId, row: body.row },
    include: { boxes: true },
  });
  if (inRow.length === 0) {
    return NextResponse.json({ error: "Rangée inexistante." }, { status: 404 });
  }
  const boxCount = inRow.reduce((acc, l) => acc + l.boxes.length, 0);
  if (boxCount > 0) {
    return NextResponse.json({ error: `${boxCount} boîte(s) sur cette rangée.` }, { status: 409 });
  }

  await prisma.location.deleteMany({ where: { placeId, row: body.row } });

  const below = await prisma.location.findMany({
    where: { placeId, row: { gt: body.row } },
    orderBy: [{ row: "asc" }, { slot: "asc" }],
  });
  for (const l of below) {
    const newRow = l.row - 1;
    const newAisle = `R${newRow}`;
    await prisma.location.update({
      where: { id: l.id },
      data: { row: newRow, aisle: newAisle, code: `${newAisle}-${l.slot}__tmp` },
    });
  }
  for (const l of below) {
    const fresh = await prisma.location.findUnique({ where: { id: l.id } });
    if (fresh) {
      await prisma.location.update({
        where: { id: l.id },
        data: { code: fresh.code.replace(/__tmp$/, "") },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

async function resetPlan(
  placeId: string,
  userId: string,
  body: { rows?: number; cells?: number }
) {
  const rows = Math.max(1, Math.min(30, body.rows ?? 3));
  const cells = Math.max(1, Math.min(30, body.cells ?? 4));

  await prisma.box.deleteMany({ where: { placeId } });
  await prisma.location.deleteMany({ where: { placeId } });

  for (let r = 1; r <= rows; r++) {
    const aisle = `R${r}`;
    for (let c = 0; c < cells; c++) {
      await prisma.location.create({
        data: {
          placeId, userId,
          code: `${aisle}-${c + 1}`,
          aisle, slot: c + 1,
          row: r, col: c,
          type: "cell", capacity: 20, enabled: true,
        },
      });
    }
  }
  return NextResponse.json({ ok: true, rows, cells });
}
