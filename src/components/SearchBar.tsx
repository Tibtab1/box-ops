"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

type SearchResult = {
  id: string;
  name: string;
  color: string;
  tags: string[];
  location: { code: string } | null;
};

type Props = {
  onSelectResult: (boxId: string, code: string | null) => void;
  onResultsChange: (codes: Set<string>) => void;
};

export default function SearchBar({
  onSelectResult,
  onResultsChange,
}: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (!term) {
      setResults([]);
      onResultsChange(new Set());
      return;
    }
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      const data: SearchResult[] = await res.json();
      setResults(data);
      onResultsChange(
        new Set(data.map((r) => r.location?.code).filter(Boolean) as string[])
      );
      setOpen(true);
    }, 180);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="relative">
      <div className="relative flex items-stretch panel !shadow-stamp !border-ink bg-paper">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60 grid place-items-center px-3 border-r-2 border-ink">
          ⌕ rech
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Nom, tag, contenu, code d'emplacement…"
          className="flex-1 bg-transparent px-3 py-2.5 font-mono text-sm text-ink placeholder:text-ink/40 focus:outline-none"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="font-mono text-xs uppercase tracking-widest px-3 border-l-2 border-ink hover:bg-paper-dark"
            aria-label="Effacer"
          >
            ✕
          </button>
        )}
      </div>

      {open && q && (
        <div className="absolute z-20 top-full left-0 right-0 mt-2 panel max-h-80 overflow-auto">
          {results.length === 0 ? (
            <div className="p-4 font-mono text-xs uppercase tracking-widest text-ink/50">
              Aucun résultat pour « {q} »
            </div>
          ) : (
            <ul className="divide-y-2 divide-dashed divide-ink/15">
              <li className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60 bg-paper-dark/40">
                {results.length} résultat
                {results.length > 1 ? "s" : ""}
              </li>
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() =>
                      onSelectResult(r.id, r.location?.code ?? null)
                    }
                    className="w-full text-left p-3 flex items-center gap-3 hover:bg-paper-dark/60 transition-colors"
                  >
                    <span
                      className="w-4 h-4 border-2 border-ink shrink-0"
                      style={{ backgroundColor: r.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-ink truncate">
                        {r.name}
                      </div>
                      {r.tags.length > 0 && (
                        <div className="font-mono text-[10px] text-ink/60 truncate">
                          {r.tags.map((t) => `#${t}`).join("  ·  ")}
                        </div>
                      )}
                    </div>
                    <span
                      className={clsx(
                        "stamp-badge shrink-0",
                        r.location
                          ? "bg-blueprint text-paper border-ink"
                          : "bg-paper text-ink/50 border-ink/30"
                      )}
                    >
                      {r.location?.code ?? "∅"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
