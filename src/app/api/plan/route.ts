import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;
  const { userId } = auth;

  const body = await req.json();
  const action = body.action as string;

  switch (action) {
    case "add_cell_right":
      return addCellRight(userId, body);
    case "add_cell_left":
      return addCellLeft(userId, body);
    case "remove_cell_right":
      return removeCellRight(userId, body);
    case "remove_cell_left":
      return removeCellLeft(userId, body);
    case "add_row":
      return addRow(userId, body);
    case "remove_row":
      return removeRow(userId, body);
    case "reset":
      return resetPlan(userId, body);
    default:
      return NextResponse.json(
        { error: `Action inconnue : ${action}` },
        { status: 400 }
      );
  }
}

async function rowInfo(userId: string, row: number) {
  const cells = await prisma.location.findMany({
    where: { userId, row },
    orderBy: { col: "asc" },
  });
  if (cells.length === 0) return null;
  const minCol = cells[0].col;
  const maxCol = cells[cells.length - 1].col;
  const maxSlot = Math.max(...cells.map((c) => c.slot));
  const aisle = cells[0].aisle;
  return { cells, minCol, maxCol, maxSlot, aisle };
}

async function nextFreeSlot(userId: string, aisle: string): Promise<number> {
  const existing = await prisma.location.findMany({
    where: { userId, aisle },
    select: { slot: true },
  });
  const used = new Set(existing.map((e) => e.slot));
  let s = 1;
  while (used.has(s)) s++;
  return s;
}

function uniqueCode(aisle: string, slot: number): string {
  return `${aisle}-${slot}`;
}

async function addCellRight(
  userId: string,
  body: { row: number; type?: string }
) {
  const info = await rowInfo(userId, body.row);
  if (!info) {
    return NextResponse.json({ error: "Rangée inexistante." }, { status: 404 });
  }
  const type = body.type === "aisle" ? "aisle" : "cell";
  const slot = await nextFreeSlot(userId, info.aisle);
  await prisma.location.create({
    data: {
      userId,
      code: uniqueCode(info.aisle, slot),
      aisle: info.aisle,
      slot,
      row: body.row,
      col: info.maxCol + 1,
      type,
      capacity: 5,
      enabled: true,
    },
  });
  return NextResponse.json({ ok: true });
}

async function addCellLeft(
  userId: string,
  body: { row: number; type?: string }
) {
  const info = await rowInfo(userId, body.row);
  if (!info) {
    return NextResponse.json({ error: "Rangée inexistante." }, { status: 404 });
  }
  const type = body.type === "aisle" ? "aisle" : "cell";

  if (info.minCol > 0) {
    const slot = await nextFreeSlot(userId, info.aisle);
    await prisma.location.create({
      data: {
        userId,
        code: uniqueCode(info.aisle, slot),
        aisle: info.aisle,
        slot,
        row: body.row,
        col: info.minCol - 1,
        type,
        capacity: 5,
        enabled: true,
      },
    });
    return NextResponse.json({ ok: true });
  }

  // Shift all cells of THIS user to the right by 1
  const allCells = await prisma.location.findMany({
    where: { userId },
    orderBy: { col: "desc" },
  });
  for (const c of allCells) {
    await prisma.location.update({
      where: { id: c.id },
      data: { col: c.col + 1 },
    });
  }
  const slot = await nextFreeSlot(userId, info.aisle);
  await prisma.location.create({
    data: {
      userId,
      code: uniqueCode(info.aisle, slot),
      aisle: info.aisle,
      slot,
      row: body.row,
      col: 0,
      type,
      capacity: 5,
      enabled: true,
    },
  });
  return NextResponse.json({ ok: true, shifted: true });
}

async function removeCellRight(userId: string, body: { row: number }) {
  const info = await rowInfo(userId, body.row);
  if (!info) {
    return NextResponse.json({ error: "Rangée inexistante." }, { status: 404 });
  }
  if (info.cells.length <= 1) {
    return NextResponse.json(
      { error: "Impossible : une rangée doit avoir au moins une cellule." },
      { status: 400 }
    );
  }
  const last = info.cells[info.cells.length - 1];
  const boxCount = await prisma.box.count({ where: { locationId: last.id } });
  if (boxCount > 0) {
    return NextResponse.json(
      { error: `Impossible : ${boxCount} boîte(s) sur ${last.code}.` },
      { status: 409 }
    );
  }
  await prisma.location.delete({ where: { id: last.id } });
  return NextResponse.json({ ok: true });
}

async function removeCellLeft(userId: string, body: { row: number }) {
  const info = await rowInfo(userId, body.row);
  if (!info) {
    return NextResponse.json({ error: "Rangée inexistante." }, { status: 404 });
  }
  if (info.cells.length <= 1) {
    return NextResponse.json(
      { error: "Impossible : une rangée doit avoir au moins une cellule." },
      { status: 400 }
    );
  }
  const first = info.cells[0];
  const boxCount = await prisma.box.count({ where: { locationId: first.id } });
  if (boxCount > 0) {
    return NextResponse.json(
      { error: `Impossible : ${boxCount} boîte(s) sur ${first.code}.` },
      { status: 409 }
    );
  }
  await prisma.location.delete({ where: { id: first.id } });
  return NextResponse.json({ ok: true });
}

async function addRow(
  userId: string,
  body: { cells?: number; startCol?: number }
) {
  const cells = Math.max(1, Math.min(30, body.cells ?? 4));
  const startCol = Math.max(0, body.startCol ?? 0);

  const existing = await prisma.location.findMany({
    where: { userId },
    select: { row: true },
  });
  const maxRow = existing.length
    ? Math.max(...existing.map((l) => l.row))
    : 0;
  const newRow = maxRow + 1;
  const aisle = `R${newRow}`;

  for (let i = 0; i < cells; i++) {
    await prisma.location.create({
      data: {
        userId,
        code: `${aisle}-${i + 1}`,
        aisle,
        slot: i + 1,
        row: newRow,
        col: startCol + i,
        type: "cell",
        capacity: 5,
        enabled: true,
      },
    });
  }
  return NextResponse.json({ ok: true, row: newRow, aisle });
}

async function removeRow(userId: string, body: { row: number }) {
  if (typeof body.row !== "number") {
    return NextResponse.json({ error: "row manquant." }, { status: 400 });
  }
  const inRow = await prisma.location.findMany({
    where: { userId, row: body.row },
    include: { boxes: true },
  });
  if (inRow.length === 0) {
    return NextResponse.json({ error: "Rangée inexistante." }, { status: 404 });
  }
  const boxCount = inRow.reduce((acc, l) => acc + l.boxes.length, 0);
  if (boxCount > 0) {
    return NextResponse.json(
      { error: `Impossible : ${boxCount} boîte(s) sur cette rangée.` },
      { status: 409 }
    );
  }

  await prisma.location.deleteMany({ where: { userId, row: body.row } });

  const below = await prisma.location.findMany({
    where: { userId, row: { gt: body.row } },
    orderBy: [{ row: "asc" }, { slot: "asc" }],
  });
  for (const l of below) {
    const newRow = l.row - 1;
    const newAisle = `R${newRow}`;
    await prisma.location.update({
      where: { id: l.id },
      data: {
        row: newRow,
        aisle: newAisle,
        code: `${newAisle}-${l.slot}__tmp`,
      },
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
  userId: string,
  body: { rows?: number; cells?: number }
) {
  const rows = Math.max(1, Math.min(30, body.rows ?? 3));
  const cells = Math.max(1, Math.min(30, body.cells ?? 4));

  // Only delete THIS user's data
  await prisma.box.deleteMany({ where: { userId } });
  await prisma.location.deleteMany({ where: { userId } });

  for (let r = 1; r <= rows; r++) {
    const aisle = `R${r}`;
    for (let c = 0; c < cells; c++) {
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

  return NextResponse.json({ ok: true, rows, cells });
}
