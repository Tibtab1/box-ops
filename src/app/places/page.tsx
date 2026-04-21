"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import Link from "next/link";

type Place = {
  id: string;
  name: string;
  description: string | null;
  isOwner: boolean;
  role: "owner" | "admin" | "editor" | "viewer";
  locationsCount: number;
  boxesCount: number;
  createdAt: string;
};

export default function PlacesPage() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function load() {
    const res = await fetch("/api/places");
    const data = await res.json();
    setPlaces(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function deletePlace(id: string, name: string) {
    if (!confirm(`Supprimer « ${name} » ? Toutes ses boîtes seront perdues.`)) return;
    setError(null);
    const res = await fetch(`/api/places/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erreur.");
      return;
    }
    await load();
  }

  async function saveRename(id: string) {
    const name = editName.trim();
    if (!name) return;
    const res = await fetch(`/api/places/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setEditingId(null);
      setEditName("");
      await load();
    }
  }

  async function makeActive(id: string) {
    await fetch("/api/places/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: id }),
    });
    window.location.href = "/";
  }

  return (
    <main className="min-h-screen">
      <header className="border-b-2 border-ink bg-paper/90 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-10 h-10 bg-ink grid place-items-center shadow-stamp hover:-translate-y-0.5 transition-transform"
            >
              <span className="font-mono text-paper text-lg font-bold">▣</span>
            </Link>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60 leading-none">
                Administration · ed. 10
              </div>
              <h1 className="font-display font-black text-ink text-2xl leading-none mt-0.5">
                Mes lieux
              </h1>
            </div>
          </div>
          <Link href="/" className="btn-ghost">
            ← Retour
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {error && (
          <div className="panel bg-safety text-paper border-ink p-3 font-mono text-[11px] uppercase tracking-[0.2em] text-center">
            {error}
          </div>
        )}

        {loading ? (
          <div className="panel p-8 font-mono text-xs uppercase tracking-widest text-ink/50 text-center">
            Chargement…
          </div>
        ) : places.length === 0 ? (
          <div className="panel p-8 text-center">
            <p className="font-display text-xl text-ink">Aucun lieu pour l'instant.</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink/50 mt-2">
              Créez-en un via le sélecteur du plan principal.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {places.map((p) => (
              <li key={p.id} className="panel p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    {editingId === p.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename(p.id);
                            if (e.key === "Escape") {
                              setEditingId(null);
                              setEditName("");
                            }
                          }}
                          className="input-field !py-1.5 !text-lg !font-display !font-bold"
                          maxLength={80}
                        />
                        <button
                          onClick={() => saveRename(p.id)}
                          className="btn-primary !px-3 !py-1.5 !text-xs"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditName("");
                          }}
                          className="btn-ghost !px-3 !py-1.5 !text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <h2 className="font-display text-2xl font-black text-ink break-words">
                        {p.name}
                      </h2>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span
                        className={clsx(
                          "stamp-badge border-ink text-paper !text-[9px]",
                          p.isOwner ? "bg-ink" : "bg-blueprint"
                        )}
                      >
                        {p.isOwner ? "Propriétaire" : p.role}
                      </span>
                      <span className="font-mono text-[10px] text-ink/60 uppercase tracking-widest">
                        {p.boxesCount} boîte{p.boxesCount > 1 ? "s" : ""} ·{" "}
                        {p.locationsCount} emplacement{p.locationsCount > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => makeActive(p.id)}
                      className="btn-safety !text-xs"
                    >
                      Ouvrir
                    </button>
                    {p.isOwner && editingId !== p.id && (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(p.id);
                            setEditName(p.name);
                          }}
                          className="btn-ghost !text-xs"
                        >
                          ✎ Renommer
                        </button>
                        <button
                          onClick={() => deletePlace(p.id, p.name)}
                          className="btn-ghost !text-xs !border-safety !text-safety"
                        >
                          🗑 Supprimer
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="font-mono text-[10px] text-ink/40 uppercase tracking-widest text-center mt-8">
          Le partage entre comptes arrive dans l'itération 2
        </p>
      </div>
    </main>
  );
}
