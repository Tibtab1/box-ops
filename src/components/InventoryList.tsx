"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";

type InventoryBox = {
  id: string;
  name: string;
  tags: string[];
  color: string;
  location: { code: string } | null;
  updatedAt: string;
};

type SortKey = "name" | "location" | "updatedAt";
type SortDir = "asc" | "desc";

type Props = {
  boxes: InventoryBox[];
  onOpenBox: (id: string) => void;
};

export default function InventoryList({ boxes, onOpenBox }: Props) {
  const [filter, setFilter] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [placedOnly, setPlacedOnly] = useState<"all" | "placed" | "unplaced">(
    "all"
  );
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    boxes.forEach((b) => b.tags.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [boxes]);

  const filteredSorted = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    let list = boxes.filter((b) => {
      if (placedOnly === "placed" && !b.location) return false;
      if (placedOnly === "unplaced" && b.location) return false;
      if (tagFilter && !b.tags.includes(tagFilter)) return false;
      if (needle) {
        const hay = [b.name, ...b.tags, b.location?.code ?? ""]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });

    list = list.slice().sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "location") {
        const ac = a.location?.code ?? "~~~";
        const bc = b.location?.code ?? "~~~";
        cmp = ac.localeCompare(bc);
      } else cmp = a.updatedAt.localeCompare(b.updatedAt);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [boxes, filter, tagFilter, placedOnly, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="panel">
      {/* Toolbar */}
      <div className="p-4 border-b-2 border-ink/15 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60">
              Registre complet
            </div>
            <h2 className="font-display text-2xl font-black text-ink leading-none">
              Inventaire
            </h2>
          </div>
          <span className="stamp-badge bg-ink text-paper border-ink">
            {filteredSorted.length} / {boxes.length}
          </span>
        </div>

        <input
          className="input-field"
          placeholder="Filtrer par nom, tag, emplacement…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mr-1">
            Statut :
          </span>
          {(["all", "placed", "unplaced"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setPlacedOnly(s)}
              className={clsx(
                "font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 border-2 transition-all",
                placedOnly === s
                  ? "bg-ink text-paper border-ink shadow-stamp"
                  : "border-ink/30 text-ink/70 hover:border-ink"
              )}
            >
              {s === "all" ? "Toutes" : s === "placed" ? "Placées" : "Sans emplacement"}
            </button>
          ))}
        </div>

        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 mr-1">
              Tag :
            </span>
            <button
              onClick={() => setTagFilter(null)}
              className={clsx(
                "font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 border-2",
                !tagFilter
                  ? "bg-ink text-paper border-ink shadow-stamp"
                  : "border-ink/30 text-ink/70 hover:border-ink"
              )}
            >
              Tous
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setTagFilter(t === tagFilter ? null : t)}
                className={clsx(
                  "font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 border-2",
                  tagFilter === t
                    ? "bg-safety text-paper border-ink shadow-stamp"
                    : "border-ink/30 text-ink/70 hover:border-ink"
                )}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-paper-dark/40 border-b-2 border-ink/15">
              <Th
                onClick={() => toggleSort("name")}
                active={sortKey === "name"}
                dir={sortDir}
              >
                Nom
              </Th>
              <Th
                onClick={() => toggleSort("location")}
                active={sortKey === "location"}
                dir={sortDir}
              >
                Emplacement
              </Th>
              <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink/70">
                Tags
              </th>
              <Th
                onClick={() => toggleSort("updatedAt")}
                active={sortKey === "updatedAt"}
                dir={sortDir}
              >
                Maj
              </Th>
            </tr>
          </thead>
          <tbody>
            {filteredSorted.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="p-6 text-center font-mono text-xs uppercase tracking-widest text-ink/50"
                >
                  Aucune boîte ne correspond aux filtres.
                </td>
              </tr>
            ) : (
              filteredSorted.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => onOpenBox(b.id)}
                  className="border-b border-dashed border-ink/15 hover:bg-paper-dark/30 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 border-2 border-ink shrink-0"
                        style={{ backgroundColor: b.color }}
                      />
                      <span className="font-display font-bold text-ink truncate">
                        {b.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {b.location ? (
                      <span className="stamp-badge bg-blueprint text-paper border-ink">
                        {b.location.code}
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-ink/40">
                        ∅
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {b.tags.slice(0, 3).map((t) => (
                        <span key={t} className="label-tag !text-[9px]">
                          #{t}
                        </span>
                      ))}
                      {b.tags.length > 3 && (
                        <span className="font-mono text-[10px] text-ink/50">
                          +{b.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-ink/60 whitespace-nowrap">
                    {new Date(b.updatedAt).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: "asc" | "desc";
}) {
  return (
    <th
      onClick={onClick}
      className={clsx(
        "px-3 py-2 font-mono text-[10px] uppercase tracking-widest cursor-pointer select-none transition-colors",
        active ? "text-ink" : "text-ink/70 hover:text-ink"
      )}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active && <span className="text-safety">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}
