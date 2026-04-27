"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

type BoxRow = {
  id: string;
  name: string;
  color: string;
  tags: string[];
  location: { code: string; row: number; col: number } | null;
  updatedAt: string;
  kind?: "box" | "furniture" | "flat";
  flatType?: "painting" | "photo" | "poster" | "mirror" | "other" | null;
  isFragile?: boolean;
  isFavorite?: boolean;
};

type SortMode = "recent" | "alpha" | "location";
type PlacementFilter = "all" | "placed" | "unplaced";
type KindFilter = "all" | "box" | "flat" | "furniture";

type Props = {
  boxes: BoxRow[];
  onOpenBox: (id: string) => void;
  highlightedId?: string | null;
};

export default function InventoryList({ boxes, onOpenBox, highlightedId }: Props) {
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [placement, setPlacement] = useState<PlacementFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<SortMode>("recent");
  const [showFilters, setShowFilters] = useState(false);
  const highlightRef = useRef<HTMLLIElement | null>(null);

  // Scroll to highlighted item when highlightedId changes
  useEffect(() => {
    if (highlightedId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [highlightedId]);

  // Collect all tags and colors actually present in the data
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const b of boxes) for (const t of b.tags) set.add(t);
    return [...set].sort();
  }, [boxes]);

  const allColors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of boxes) {
      counts.set(b.color, (counts.get(b.color) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([color, count]) => ({ color, count }));
  }, [boxes]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let rows = boxes.filter((b) => {
      if (placement === "placed" && !b.location) return false;
      if (placement === "unplaced" && b.location) return false;
      if (kindFilter !== "all") {
        const k = b.kind ?? "box";
        if (k !== kindFilter) return false;
      }
      if (favoritesOnly && !b.isFavorite) return false;
      if (selectedColor && b.color !== selectedColor) return false;
      if (selectedTags.size > 0) {
        for (const t of selectedTags) if (!b.tags.includes(t)) return false;
      }
      if (needle) {
        const hay = [
          b.name,
          b.tags.join(" "),
          b.location?.code ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    if (sort === "alpha") {
      rows = [...rows].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    } else if (sort === "location") {
      rows = [...rows].sort((a, b) => {
        if (!a.location && !b.location) return 0;
        if (!a.location) return 1;
        if (!b.location) return -1;
        return a.location.code.localeCompare(b.location.code);
      });
    } else {
      rows = [...rows].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      );
    }
    return rows;
  }, [boxes, query, placement, kindFilter, selectedColor, selectedTags, sort]);

  const activeFilterCount =
    (selectedTags.size > 0 ? 1 : 0) +
    (selectedColor ? 1 : 0) +
    (placement !== "all" ? 1 : 0) +
    (favoritesOnly ? 1 : 0);

  function toggleTag(tag: string) {
    const next = new Set(selectedTags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    setSelectedTags(next);
  }

  function clearFilters() {
    setQuery("");
    setSelectedTags(new Set());
    setSelectedColor(null);
    setPlacement("all");
    setFavoritesOnly(false);
  }

  return (
    <div className="panel p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60">
            Inventaire
          </div>
          <h2 className="font-display text-2xl font-black text-ink leading-tight">
            {filtered.length}{" "}
            <span className="text-ink/50 font-normal text-lg">
              / {boxes.length} {kindFilter === "flat" ? "cadres" : kindFilter === "furniture" ? "meubles" : kindFilter === "box" ? "boîtes" : "éléments"}
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={clsx(
              "font-mono text-[10px] uppercase tracking-widest px-2.5 py-1.5 border-2 border-ink transition-colors",
              favoritesOnly ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-paper-dark"
            )}
            title="Afficher uniquement les favoris"
          >
            ★ Favoris
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="font-mono text-[10px] uppercase tracking-widest border-2 border-ink bg-paper px-2 py-1.5"
          >
            <option value="recent">Récent</option>
            <option value="alpha">A-Z</option>
            <option value="location">Emplacement</option>
          </select>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              "font-mono text-[10px] uppercase tracking-widest px-2.5 py-1.5 border-2 border-ink transition-colors",
              showFilters || activeFilterCount > 0
                ? "bg-ink text-paper"
                : "bg-paper text-ink"
            )}
          >
            ⚙ Filtres
            {activeFilterCount > 0 && ` (${activeFilterCount})`}
          </button>
        </div>
      </div>

      {/* Search box */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher une boîte, un tag, un emplacement…"
        className="input-field"
      />

      {/* Filter panel */}
      {showFilters && (
        <div className="space-y-3 p-3 bg-paper-dark/40 border-2 border-dashed border-ink/30">
          {/* Placement */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 mb-1.5">
              Emplacement
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(
                [
                  ["all", "Toutes"],
                  ["placed", "Placées"],
                  ["unplaced", "Sans emplacement"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setPlacement(k)}
                  className={clsx(
                    "font-mono text-[10px] uppercase tracking-widest px-2 py-1 border-2 transition-all",
                    placement === k
                      ? "bg-ink text-paper border-ink"
                      : "border-ink/30 text-ink/70 hover:border-ink"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Kind filter (box / flat / furniture) */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 mb-1.5">
              Type
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(
                [
                  ["all", "Tout"],
                  ["box", "📦 Boîtes"],
                  ["flat", "🖼 Cadres"],
                  ["furniture", "🪑 Meubles"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setKindFilter(k)}
                  className={clsx(
                    "font-mono text-[10px] uppercase tracking-widest px-2 py-1 border-2 transition-all",
                    kindFilter === k
                      ? "bg-ink text-paper border-ink"
                      : "border-ink/30 text-ink/70 hover:border-ink"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 mb-1.5">
                Tags
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {allTags.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={clsx(
                      "font-mono text-[10px] uppercase tracking-widest px-2 py-1 border-2 transition-all",
                      selectedTags.has(t)
                        ? "bg-safety text-paper border-ink"
                        : "border-ink/30 text-ink/70 hover:border-ink"
                    )}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Colors */}
          {allColors.length > 1 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 mb-1.5">
                Couleur
              </div>
              <div className="flex gap-1 flex-wrap">
                {allColors.map(({ color, count }) => (
                  <button
                    key={color}
                    onClick={() =>
                      setSelectedColor(selectedColor === color ? null : color)
                    }
                    className={clsx(
                      "w-7 h-7 border-2 transition-transform relative group",
                      selectedColor === color
                        ? "border-ink scale-110"
                        : "border-ink/30 hover:border-ink hover:scale-110"
                    )}
                    style={{ backgroundColor: color }}
                    title={`${color} · ${count} boîte(s)`}
                  >
                    {selectedColor === color && (
                      <span className="absolute inset-0 grid place-items-center text-paper font-bold text-xs drop-shadow">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="font-mono text-[10px] uppercase tracking-widest text-ink/60 hover:text-safety"
            >
              ✕ Effacer tous les filtres
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="font-mono text-xs uppercase tracking-widest text-ink/40 text-center py-8">
          {boxes.length === 0
            ? "Aucune boîte pour l'instant."
            : "Aucun résultat — essayez d'autres filtres."}
        </div>
      ) : (
        <ul className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
          {filtered.map((b) => {
            const isHighlighted = b.id === highlightedId;
            return (
              <li
                key={b.id}
                ref={isHighlighted ? highlightRef : null}
              >
                <button
                  type="button"
                  onClick={() => onOpenBox(b.id)}
                  className={clsx(
                    "w-full flex items-center gap-2.5 p-2 border-2 shadow-stamp text-left transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-stamp-lg",
                    isHighlighted ? "border-safety ring-2 ring-safety" : "border-ink"
                  )}
                  style={{ backgroundColor: b.color }}
                >
                  {b.isFavorite && (
                    <span className="text-yellow-300 shrink-0 text-sm leading-none" title="Favori">★</span>
                  )}
                  <span
                    className="font-mono text-[9px] uppercase tracking-widest bg-paper/95 text-ink px-1.5 py-0.5 border border-ink shrink-0"
                    title={b.location?.code ?? "Sans emplacement"}
                  >
                    {b.location?.code ?? "·"}
                  </span>
                  <span className="text-base shrink-0" aria-hidden>
                    {b.kind === "flat"
                      ? b.flatType === "painting"
                        ? "🎨"
                        : b.flatType === "photo"
                        ? "📷"
                        : b.flatType === "poster"
                        ? "📜"
                        : b.flatType === "mirror"
                        ? "🪞"
                        : "🖼"
                      : b.kind === "furniture"
                      ? "🪑"
                      : "📦"}
                  </span>
                  <span className="font-display font-bold text-paper flex-1 truncate">
                    {b.name}
                  </span>
                  {b.kind === "flat" && b.isFragile && (
                    <span
                      className="font-mono text-[8px] uppercase tracking-widest text-paper bg-safety/80 px-1 py-0.5 border border-paper/40 shrink-0"
                      title="Fragile"
                    >
                      ⚠
                    </span>
                  )}
                  {b.tags.length > 0 && (
                    <span className="font-mono text-[9px] text-paper/80 truncate shrink-0 max-w-[40%]">
                      {b.tags.slice(0, 3).map((t) => `#${t}`).join(" ")}
                      {b.tags.length > 3 && ` +${b.tags.length - 3}`}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
