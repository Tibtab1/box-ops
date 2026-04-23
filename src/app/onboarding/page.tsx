"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PlacePresetPicker from "@/components/PlacePresetPicker";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [preset, setPreset] = useState<string>("cellar");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // If the user already has places, they shouldn't be here — send them home.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bootstrap", { method: "POST" });
        const data = await res.json();
        if (cancelled) return;
        if (data.hasPlaces) {
          router.replace("/");
          return;
        }
        setChecking(false);
      } catch {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, preset }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la création.");
        setBusy(false);
        return;
      }
      // Set this new place as active, then go to the main app
      await fetch("/api/places/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: data.id }),
      });
      router.replace("/");
    } catch {
      setError("Erreur réseau.");
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink/50">
          Chargement…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 sm:p-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 sm:mb-12">
          <div className="w-12 h-12 border-2 border-ink shadow-stamp bg-paper grid place-items-center">
            <span className="font-display font-black text-lg">B</span>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60">
              Self-storage · Ed. 07
            </div>
            <div className="font-display text-xl font-black text-ink leading-tight">
              BOX·OPS
            </div>
          </div>
        </div>

        {/* Welcome block */}
        <div className="mb-8">
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-safety font-bold mb-2">
            ★ Bienvenue
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-black text-ink leading-tight mb-3">
            Configurons votre premier espace.
          </h1>
          <p className="font-mono text-sm text-ink/70 leading-relaxed max-w-lg">
            Donnez un nom à votre lieu de stockage et choisissez un modèle qui
            s'en rapproche. Vous pourrez tout personnaliser ensuite.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="panel p-6 sm:p-8 space-y-6">
          {/* Name */}
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink font-bold block mb-1.5">
              Nom du lieu
            </span>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="Ex: Garage, Cave, Box self-storage…"
              maxLength={80}
              required
            />
            <p className="font-mono text-[10px] text-ink/50 mt-1">
              Un nom court et mémorable. Vous pourrez en créer d'autres plus
              tard.
            </p>
          </label>

          {/* Preset picker */}
          <PlacePresetPicker value={preset} onChange={setPreset} />

          {error && (
            <div className="font-mono text-xs uppercase tracking-widest text-safety bg-safety/10 border-2 border-safety px-3 py-2">
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="btn-primary w-full text-base py-3"
              disabled={busy || !name.trim()}
            >
              {busy ? "Création…" : "Commencer →"}
            </button>
            <p className="font-mono text-[10px] text-ink/50 mt-2 text-center">
              Rassurez-vous, rien n'est définitif. Tout se modifie plus tard.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
