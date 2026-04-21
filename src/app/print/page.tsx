import { prisma } from "@/lib/prisma";
import { parseTags } from "@/lib/types";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PrintToolbar from "./PrintToolbar";
import { ACTIVE_PLACE_COOKIE } from "@/lib/require-place";
import "./print.css";

export const dynamic = "force-dynamic";

export default async function PrintPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect("/login?next=/print");
  }

  // Resolve active place (cookie or fallback to first accessible)
  let placeId = cookies().get(ACTIVE_PLACE_COOKIE)?.value ?? null;
  if (!placeId) {
    const first = await prisma.place.findFirst({
      where: {
        OR: [{ ownerId: userId }, { shares: { some: { userId } } }],
      },
      orderBy: { createdAt: "asc" },
    });
    placeId = first?.id ?? null;
  }
  if (!placeId) redirect("/");

  // Access check
  const place = await prisma.place.findFirst({
    where: {
      id: placeId,
      OR: [{ ownerId: userId }, { shares: { some: { userId } } }],
    },
  });
  if (!place) redirect("/");

  const locations = await prisma.location.findMany({
    where: { placeId },
    include: { boxes: { orderBy: { stackIndex: "asc" } } },
    orderBy: [{ row: "asc" }, { col: "asc" }],
  });

  const allBoxes = await prisma.box.findMany({
    where: { placeId },
    include: { location: true },
    orderBy: [{ location: { code: "asc" } }, { stackIndex: "desc" }],
  });

  const byRow = new Map<number, typeof locations>();
  for (const l of locations) {
    const arr = byRow.get(l.row) ?? [];
    arr.push(l);
    byRow.set(l.row, arr);
  }
  const rowsData = [...byRow.entries()]
    .sort(([a], [b]) => a - b)
    .map(([row, arr]) => {
      arr.sort((x, y) => x.col - y.col);
      return { row, cells: arr, minCol: arr[0].col, maxCol: arr[arr.length - 1].col };
    });

  if (rowsData.length === 0) {
    return (
      <div className="print-root">
        <div className="print-header">
          <h1 className="print-title">BOX·OPS — {place.name}</h1>
        </div>
        <p style={{ padding: "20mm 0", textAlign: "center" }}>
          Plan vide. Créez des cellules depuis l'éditeur avant d'imprimer.
        </p>
      </div>
    );
  }

  const globalMinCol = Math.min(...rowsData.map((r) => r.minCol));
  const globalMaxCol = Math.max(...rowsData.map((r) => r.maxCol));
  const totalCols = globalMaxCol - globalMinCol + 1;
  const now = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const placedCount = allBoxes.filter((b) => b.location).length;
  const unplaced = allBoxes.length - placedCount;

  return (
    <div className="print-root">
      <div className="print-header">
        <div>
          <div className="print-eyebrow">
            Plan de stockage · {place.name}
          </div>
          <h1 className="print-title">BOX·OPS</h1>
        </div>
        <div className="print-meta">
          <div>
            <span className="print-meta-label">Date</span>
            <span className="print-meta-value">{now}</span>
          </div>
          <div>
            <span className="print-meta-label">Boîtes</span>
            <span className="print-meta-value">
              {placedCount}
              <span className="print-meta-sub">/{allBoxes.length}</span>
            </span>
          </div>
          <div>
            <span className="print-meta-label">Rangées</span>
            <span className="print-meta-value">{rowsData.length}</span>
          </div>
        </div>
      </div>

      <section className="print-section">
        <h2 className="print-section-title">Plan général</h2>
        <div className="print-grid-wrapper">
          {rowsData.map(({ row, cells }) => (
            <div
              key={row}
              className="print-row"
              style={{ gridTemplateColumns: `2.5rem repeat(${totalCols}, 1fr)` }}
            >
              <div className="print-row-label">R{row}</div>
              {Array.from({ length: totalCols }, (_, idx) => {
                const col = globalMinCol + idx;
                const cell = cells.find((c) => c.col === col);
                if (!cell) return <div key={idx} className="print-cell-empty" />;
                if (cell.type === "aisle") {
                  return (
                    <div key={idx} className="print-cell print-cell-aisle">
                      <span className="print-cell-code">{cell.code}</span>
                      <span className="print-cell-aisle-label">allée</span>
                    </div>
                  );
                }
                if (!cell.enabled) {
                  return (
                    <div key={idx} className="print-cell print-cell-disabled">
                      <span className="print-cell-code">{cell.code}</span>
                      <span className="print-cell-aisle-label">désact.</span>
                    </div>
                  );
                }
                const stackSize = cell.boxes.length;
                const topBox = cell.boxes[stackSize - 1];
                return (
                  <div
                    key={idx}
                    className="print-cell print-cell-storage"
                    style={topBox ? { backgroundColor: topBox.color, color: "#fff" } : undefined}
                  >
                    <span className="print-cell-code">{cell.code}</span>
                    {topBox && <span className="print-cell-name">{topBox.name}</span>}
                    {stackSize > 1 && <span className="print-stack-count">×{stackSize}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="print-section print-page-break">
        <h2 className="print-section-title">Index des boîtes</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Emplt.</th>
              <th>N°</th>
              <th>Nom</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {allBoxes.map((b) => (
              <tr key={b.id}>
                <td className="print-td-code">{b.location ? b.location.code : "—"}</td>
                <td className="print-td-idx">{b.location ? `#${b.stackIndex + 1}` : ""}</td>
                <td>
                  <div className="print-td-name">
                    <span className="print-swatch" style={{ backgroundColor: b.color }} aria-hidden />
                    <span>{b.name}</span>
                  </div>
                  {b.description && <div className="print-td-desc">{b.description}</div>}
                </td>
                <td className="print-td-tags">
                  {parseTags(b.tags).map((t) => `#${t}`).join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {unplaced > 0 && (
          <p className="print-note">
            {unplaced} boîte{unplaced > 1 ? "s" : ""} sans emplacement assigné.
          </p>
        )}
      </section>

      <div className="print-footer">
        BOX·OPS · {place.name} · plan généré le {now}
      </div>

      <PrintToolbar />
    </div>
  );
}
