import { prisma } from "@/lib/prisma";
import { parseTags } from "@/lib/types";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_PLACE_COOKIE } from "@/lib/require-place";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login?next=/stock");

  let placeId = cookies().get(ACTIVE_PLACE_COOKIE)?.value ?? null;
  if (!placeId) {
    const first = await prisma.place.findFirst({
      where: { OR: [{ ownerId: userId }, { shares: { some: { userId } } }] },
      orderBy: { createdAt: "asc" },
    });
    placeId = first?.id ?? null;
  }
  if (!placeId) redirect("/");

  const place = await prisma.place.findFirst({
    where: { id: placeId, OR: [{ ownerId: userId }, { shares: { some: { userId } } }] },
  });
  if (!place) redirect("/");

  const boxes = await prisma.box.findMany({
    where: { placeId, kind: { in: ["box", "furniture"] } },
    include: { location: true },
    orderBy: [{ sku: "asc" }, { name: "asc" }],
  });

  // Group by SKU (boxes without SKU go to ungrouped)
  const bySku = new Map<string, typeof boxes>();
  const ungrouped: typeof boxes = [];

  for (const b of boxes) {
    if (b.sku) {
      const arr = bySku.get(b.sku) ?? [];
      arr.push(b);
      bySku.set(b.sku, arr);
    } else {
      ungrouped.push(b);
    }
  }

  const totalUnits = boxes.reduce((s, b) => s + b.quantity, 0);
  const withSku = boxes.filter((b) => b.sku).length;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60 mb-1">
              Inventaire stock
            </div>
            <h1 className="font-display text-3xl font-black text-ink">
              BOX·OPS — {place.name}
            </h1>
          </div>
          <Link href="/" className="btn-ghost !text-xs">
            ← Plan
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Articles" value={boxes.length} />
          <StatCard label="Unités totales" value={totalUnits} />
          <StatCard label="Avec SKU" value={withSku} />
        </div>

        {/* Grouped by SKU */}
        {bySku.size > 0 && (
          <section className="space-y-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60 border-b-2 border-dashed border-ink/20 pb-2">
              Par référence SKU
            </h2>
            {[...bySku.entries()].map(([sku, items]) => {
              const totalQty = items.reduce((s, b) => s + b.quantity, 0);
              return (
                <div key={sku} className="panel p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-sm font-bold tracking-wider text-ink">
                      {sku}
                    </span>
                    <span className="stamp-badge bg-ink text-paper border-ink">
                      {totalQty} unité{totalQty > 1 ? "s" : ""}
                    </span>
                  </div>
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="text-ink/50 uppercase tracking-wider border-b border-ink/20">
                        <th className="text-left pb-1.5">Nom</th>
                        <th className="text-left pb-1.5">Empl.</th>
                        <th className="text-right pb-1.5">Qté</th>
                        <th className="text-left pb-1.5 pl-3">Tags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink/10">
                      {items.map((b) => (
                        <tr key={b.id} className="py-1">
                          <td className="py-1.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 border border-ink/30 shrink-0"
                                style={{ backgroundColor: b.color }}
                              />
                              <span className="font-bold text-ink">{b.name}</span>
                            </div>
                          </td>
                          <td className="py-1.5 text-ink/70">
                            {b.location ? b.location.code : "—"}
                          </td>
                          <td className="py-1.5 text-right font-bold">{b.quantity}</td>
                          <td className="py-1.5 pl-3 text-ink/50">
                            {parseTags(b.tags).map((t) => `#${t}`).join(" ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </section>
        )}

        {/* Ungrouped */}
        {ungrouped.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60 border-b-2 border-dashed border-ink/20 pb-2">
              Sans référence SKU ({ungrouped.length})
            </h2>
            <div className="panel">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-ink/50 uppercase tracking-wider border-b border-ink/20">
                    <th className="text-left p-3 pb-1.5">Nom</th>
                    <th className="text-left pb-1.5">Empl.</th>
                    <th className="text-right pb-1.5 pr-4">Qté</th>
                    <th className="text-left pb-1.5">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {ungrouped.map((b) => (
                    <tr key={b.id}>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 border border-ink/30 shrink-0"
                            style={{ backgroundColor: b.color }}
                          />
                          <span className="font-bold text-ink">{b.name}</span>
                        </div>
                      </td>
                      <td className="py-2 text-ink/70">
                        {b.location ? b.location.code : "—"}
                      </td>
                      <td className="py-2 text-right pr-4">{b.quantity}</td>
                      <td className="py-2 text-ink/50">
                        {parseTags(b.tags).map((t) => `#${t}`).join(" ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {boxes.length === 0 && (
          <div className="panel p-8 text-center font-mono text-sm text-ink/60">
            Aucun article. Créez des boîtes depuis le plan.
          </div>
        )}

        <p className="font-mono text-[10px] text-ink/40 text-center uppercase tracking-widest">
          BOX·OPS · {place.name} · inventaire stock
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel p-4 text-center">
      <div className="font-display text-3xl font-black text-ink">{value}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mt-1">
        {label}
      </div>
    </div>
  );
}
