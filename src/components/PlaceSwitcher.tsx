"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import PlacePresetPicker from "@/components/PlacePresetPicker";

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
  const [creating, setCreating] = useState(false); // modal open flag
  const [newName, setNewName] = useState("");
  const [newPreset, setNewPreset] = useState<string>("cellar");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false); // needed for SSR-safe portal
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (creating) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [creating]);

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
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, preset: newPreset }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la création.");
        setBusy(false);
        return;
      }
      setNewName("");
      setNewPreset("cellar");
      setCreating(false);
      await fetch("/api/places/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: data.id }),
      });
      window.location.reload();
    } catch {
      setError("Erreur réseau.");
      setBusy(false);
    }
  }

  const active = places.find((p) => p.id === activeId);

  if (loading) {
    return (
      <div className="border-2 border-ink shadow-stamp bg-paper px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/40">
        …
      </div>
    );
  }

  // The modal is rendered via a portal into <body>, so it cannot be clipped
  // by any parent overflow, transform, or stacking context.
  const modalContent = creating && (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: "rgba(10, 20, 40, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "2rem 1rem",
        overflowY: "auto",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          setCreating(false);
          setError(null);
        }
      }}
    >
      <form
        onSubmit={createPlace}
        className="panel w-full max-w-xl p-6 space-y-5"
        style={{ marginTop: "4vh", marginBottom: "4vh" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink/60">
              Nouveau lieu
            </div>
            <h2 className="font-display text-2xl font-black text-ink leading-tight mt-0.5">
              Configurer l'espace
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!busy) {
                setCreating(false);
                setError(null);
              }
            }}
            className="btn-ghost !px-2.5 !py-1.5"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/70 block mb-1.5">
            Nom du lieu
          </span>
          <input
            type="text"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="input-field"
            placeholder="Ex: Garage, Cave, Box self-storage…"
            maxLength={80}
            required
          />
        </label>

        <PlacePresetPicker value={newPreset} onChange={setNewPreset} />

        {error && (
          <div className="font-mono text-xs uppercase tracking-widest text-safety bg-safety/10 border-2 border-safety px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setError(null);
            }}
            className="btn-ghost"
            disabled={busy}
          >
            Annuler
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Création…" : "Créer le lieu"}
          </button>
        </div>
      </form>
    </div>
  );

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
            <button
              onClick={() => {
                setCreating(true);
                setOpen(false);
              }}
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
          </div>
        </div>
      )}

      {/* Render modal through a portal so it escapes any parent stacking context */}
      {mounted && modalContent && createPortal(modalContent, document.body)}
    </div>
  );
}
