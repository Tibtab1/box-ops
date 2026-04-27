"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSent(true);
    setBusy(false);
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <div className="w-14 h-14 bg-ink grid place-items-center shadow-stamp mx-auto mb-3">
            <span className="font-mono text-paper text-2xl font-bold">▣</span>
          </div>
          <h1 className="font-display text-3xl font-black text-ink mt-1">
            BOX·OPS
          </h1>
        </div>

        <div className="panel p-5 sm:p-6 space-y-4 reveal">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60">
              Accès
            </div>
            <h2 className="font-display text-2xl font-black text-ink">
              Mot de passe oublié
            </h2>
          </div>

          {sent ? (
            <div className="space-y-4">
              <div className="font-mono text-sm bg-blueprint/10 border-2 border-blueprint text-ink px-4 py-3 leading-relaxed">
                Si un compte existe pour <strong>{email}</strong>, un email de réinitialisation vient d&apos;être envoyé. Vérifiez vos spams.
              </div>
              <Link
                href="/login"
                className="btn-ghost w-full text-center block"
              >
                ← Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="font-mono text-[11px] text-ink/60 uppercase tracking-widest leading-relaxed">
                Entrez votre email pour recevoir un lien de réinitialisation.
              </p>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 block mb-1.5">
                  Email <span className="text-safety">*</span>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="vous@exemple.fr"
                  required
                  autoFocus
                />
              </label>
              <button
                type="submit"
                disabled={busy || !email}
                className="btn-primary w-full disabled:opacity-50"
              >
                {busy ? "Envoi…" : "Envoyer le lien"}
              </button>
              <Link
                href="/login"
                className="block text-center font-mono text-[10px] uppercase tracking-widest text-ink/50 hover:text-ink transition-colors"
              >
                ← Retour à la connexion
              </Link>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
