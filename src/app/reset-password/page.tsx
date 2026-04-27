"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetPasswordContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="panel p-6 space-y-4 reveal">
        <p className="font-mono text-sm text-safety">Lien invalide ou manquant.</p>
        <Link href="/forgot-password" className="btn-ghost block text-center">
          Refaire une demande
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erreur.");
      setBusy(false);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2500);
  }

  if (done) {
    return (
      <div className="panel p-6 space-y-3 reveal">
        <div className="font-mono text-sm bg-blueprint/10 border-2 border-blueprint text-ink px-4 py-3">
          Mot de passe mis à jour. Redirection vers la connexion…
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="panel p-5 sm:p-6 space-y-4 reveal">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60">Accès</div>
        <h2 className="font-display text-2xl font-black text-ink">Nouveau mot de passe</h2>
      </div>

      {error && (
        <div className="font-mono text-xs text-safety bg-safety/10 border-2 border-safety px-3 py-2">
          {error}
        </div>
      )}

      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 block mb-1.5">
          Nouveau mot de passe <span className="text-safety">*</span>
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field"
          placeholder="Min. 8 caractères"
          required
          minLength={8}
          autoFocus
        />
      </label>

      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 block mb-1.5">
          Confirmer <span className="text-safety">*</span>
        </span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="input-field"
          placeholder="••••••••"
          required
        />
      </label>

      <button
        type="submit"
        disabled={busy || !password || !confirm}
        className="btn-primary w-full disabled:opacity-50"
      >
        {busy ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <div className="w-14 h-14 bg-ink grid place-items-center shadow-stamp mx-auto mb-3">
            <span className="font-mono text-paper text-2xl font-bold">▣</span>
          </div>
          <h1 className="font-display text-3xl font-black text-ink mt-1">BOX·OPS</h1>
        </div>
        <Suspense fallback={<div />}>
          <ResetPasswordContent />
        </Suspense>
      </div>
    </main>
  );
}
