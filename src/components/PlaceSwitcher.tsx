"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

type Place = {
  id: string;
  name: string;
  isOwner: boolean;
  role: "owner" | "admin" | "editor" | "viewer";
  locationsCount: number;
  boxesCount: number;
};

type Props = {
  /** Called when the active place changes, so the parent can refresh data. */
  onActivePlaceChange?: (placeId: string) => void;
};

export default function PlaceSwitcher({ onActivePlaceChange }: Props) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  async function load() {
    const [placesRes, activeRes] = await Promise.all([
      fetch("/api/places").then((r) => r.json()),
      fetch("/api/places/active").then((r) => r.json()),
    ]);
    setPlaces(placesRes);
    setActiveId(activeRes.placeId ?? placesRes[0]?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Close on outside click — more reliable than onBlur which fights with child clicks
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function pickPlace(id: string) {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    await fetch("/api/places/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: id }),
    });
    setActiveId(id);
    setOpen(false);
    onActivePlaceChange?.(id);
    window.location.reload();
  }

  async function createPlace(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const res = await fetch("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setNewName("");
    setCreating(false);
    await fetch("/api/places/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: data.id }),
    });
    window.location.reload();
  }

  const active = places.find((p) => p.id === activeId);

  if (loading) {
    return (
      <div className="border-2 border-ink shadow-stamp bg-paper px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/40">
        …
      </div>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          "border-2 border-ink shadow-stamp bg-paper px-3 py-1.5",
          "flex items-center gap-2 min-w-[140px]",
          "hover:-translate-y-0.5 hover:shadow-stamp-lg transition-transform"
        )}
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink/50">
          Lieu
        </span>
        <span className="font-display font-bold text-sm text-ink truncate flex-1 text-left">
          {active?.name ?? "—"}
        </span>
        <span className="font-mono text-[10px] text-ink/40">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 panel min-w-[260px] z-30 max-h-[400px] overflow-y-auto">
          <div className="px-3 py-2 border-b-2 border-dashed border-ink/15 font-mono text-[10px] uppercase tracking-widest text-ink/60">
            Mes lieux
          </div>
          <ul>
            {places.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => pickPlace(p.id)}
                  className={clsx(
                    "w-full text-left px-3 py-2 flex items-center gap-2 transition-colors",
                    p.id === activeId
                      ? "bg-ink text-paper"
                      : "hover:bg-paper-dark"
                  )}
                >
                  <span className="flex-1 min-w-0">
                    <span className="font-display font-bold text-sm block truncate">
                      {p.name}
                    </span>
                    <span
                      className={clsx(
                        "font-mono text-[9px] uppercase tracking-widest",
                        p.id === activeId ? "text-paper/70" : "text-ink/50"
                      )}
                    >
                      {p.boxesCount} boîte{p.boxesCount > 1 ? "s" : ""} ·{" "}
                      {p.isOwner ? "propriétaire" : p.role}
                    </span>
                  </span>
                  {p.id === activeId && (
                    <span className="font-mono text-xs shrink-0">✓</span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t-2 border-dashed border-ink/15 p-2">
            {creating ? (
              <form onSubmit={createPlace} className="space-y-2">
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input-field !py-1.5 !text-sm"
                  placeholder="Nom du nouveau lieu"
                  maxLength={80}
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setNewName("");
                    }}
                    className="btn-ghost !text-[10px] !py-1.5"
                  >
                    Annuler
                  </button>
                  <button type="submit" className="btn-primary !text-[10px] !py-1.5">
                    Créer
                  </button>
                </div>
              </form>
            ) : (
              <>
                <button
                  onClick={() => setCreating(true)}
                  className="w-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink hover:bg-paper-dark text-left"
                >
                  + Nouveau lieu
                </button>
                <a
                  href="/places"
                  className="block px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/70 hover:bg-paper-dark text-left"
                >
                  ⚙ Gérer mes lieux
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
