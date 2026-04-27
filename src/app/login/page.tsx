"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";

type Mode = "signin" | "signup";

function LoginContent() {
  const params = useSearchParams();
  const nextPath = params.get("next") || "/";
  const oauthError = params.get("error");

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (mode === "signup") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Erreur d'inscription.");
          setBusy(false);
          return;
        }
      }

      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError(
          mode === "signup"
            ? "Compte créé, mais connexion impossible. Réessayez."
            : "Identifiants incorrects."
        );
        setBusy(false);
        return;
      }
      window.location.href = nextPath;
    } catch {
      setError("Erreur réseau.");
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    await signIn("google", { callbackUrl: nextPath });
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <div className="w-14 h-14 bg-ink grid place-items-center shadow-stamp mx-auto mb-3">
            <span className="font-mono text-paper text-2xl font-bold">▣</span>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60">
            Self-storage · ed. 08
          </div>
          <h1 className="font-display text-4xl font-black text-ink mt-1">
            BOX·OPS
          </h1>
        </div>

        <div className="panel p-5 sm:p-6 space-y-4 reveal">
          {/* Mode tabs */}
          <div className="flex border-2 border-ink shadow-stamp bg-paper">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={clsx(
                  "flex-1 font-mono text-[10px] uppercase tracking-[0.2em] px-3 py-2.5 transition-colors",
                  mode === m
                    ? "bg-ink text-paper"
                    : "bg-paper text-ink hover:bg-paper-dark"
                )}
              >
                {m === "signin" ? "Se connecter" : "Créer un compte"}
              </button>
            ))}
          </div>

          {(error || oauthError) && (
            <div className="font-mono text-xs text-safety bg-safety/10 border-2 border-safety px-3 py-2">
              {error ?? `Erreur OAuth : ${oauthError}`}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 block mb-1.5">
                  Nom (optionnel)
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="Jean Dupont"
                  maxLength={100}
                />
              </label>
            )}
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
                autoComplete="email"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 block mb-1.5">
                Mot de passe <span className="text-safety">*</span>
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder={mode === "signup" ? "Min. 8 caractères" : "••••••••"}
                required
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={mode === "signup" ? 8 : undefined}
              />
            </label>

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy
                ? "…"
                : mode === "signin"
                ? "Se connecter"
                : "Créer le compte"}
            </button>
            {mode === "signin" && (
              <div className="text-right">
                <a
                  href="/forgot-password"
                  className="font-mono text-[10px] uppercase tracking-widest text-ink/50 hover:text-ink transition-colors"
                >
                  Mot de passe oublié ?
                </a>
              </div>
            )}
          </form>

          <div className="flex items-center gap-3">
            <span className="flex-1 h-px bg-ink/20" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
              ou
            </span>
            <span className="flex-1 h-px bg-ink/20" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={busy}
            className="btn-ghost w-full !border-ink !py-2.5"
          >
            <svg width="16" height="16" viewBox="0 0 48 48" className="shrink-0">
              <path
                fill="#FFC107"
                d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"
              />
              <path
                fill="#FF3D00"
                d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4 5.6l.1-.1 6.2 5.2c-.4.4 6.6-4.8 6.6-14.7 0-1.3-.1-2.6-.4-3.9z"
              />
            </svg>
            Continuer avec Google
          </button>

          <p className="font-mono text-[10px] text-ink/50 text-center pt-2 border-t border-dashed border-ink/20">
            {mode === "signin"
              ? "Pas de compte ? Utilisez l'onglet « Créer un compte »."
              : "Déjà inscrit ? Utilisez l'onglet « Se connecter »."}
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams must be wrapped in Suspense in the app router
  return (
    <Suspense fallback={<div />}>
      <LoginContent />
    </Suspense>
  );
}
