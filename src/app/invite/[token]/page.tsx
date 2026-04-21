"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import clsx from "clsx";

type InviteInfo = {
  placeName: string;
  invitedBy: string;
  role: "viewer" | "editor" | "admin";
  maxUses: number | null;
  usedCount: number;
  remaining: number | null;
  expiresAt: string | null;
};

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const { status, data: session } = useSession();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch(`/api/invitations/token/${token}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Invitation invalide.");
        } else {
          setInfo(data);
        }
      } catch {
        if (!cancelled) setError("Erreur réseau.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invitations/token/${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur.");
        setAccepting(false);
        return;
      }
      // Set the accepted place as active and go home
      await fetch("/api/places/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: data.placeId }),
      });
      router.push("/");
    } catch {
      setError("Erreur réseau.");
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="font-mono text-xs uppercase tracking-widest text-ink/50">
          Chargement…
        </div>
      </main>
    );
  }

  if (error && !info) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="panel p-6 max-w-md text-center space-y-3">
          <div className="stamp-badge bg-safety text-paper border-ink inline-block">
            Invitation invalide
          </div>
          <p className="font-display text-xl text-ink">{error}</p>
          <a href="/" className="btn-ghost inline-block">
            Retour à l'accueil
          </a>
        </div>
      </main>
    );
  }

  if (!info) return null;

  const roleLabel =
    info.role === "admin"
      ? "Administrateur"
      : info.role === "editor"
      ? "Contributeur"
      : "Lecteur";

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <div className="w-14 h-14 bg-ink grid place-items-center shadow-stamp mx-auto mb-3">
            <span className="font-mono text-paper text-2xl font-bold">▣</span>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60">
            Invitation à rejoindre
          </div>
          <h1 className="font-display text-3xl font-black text-ink mt-1 break-words">
            {info.placeName}
          </h1>
        </div>

        <div className="panel p-5 space-y-4">
          <p className="text-ink text-sm leading-relaxed">
            <span className="font-bold">{info.invitedBy}</span> vous invite à
            rejoindre le lieu <span className="font-bold">{info.placeName}</span>{" "}
            en tant que{" "}
            <span className="stamp-badge bg-blueprint text-paper border-ink !text-[9px] align-baseline">
              {roleLabel}
            </span>
          </p>

          <div className="font-mono text-[10px] uppercase tracking-widest text-ink/60 border-t border-dashed border-ink/20 pt-3 space-y-1">
            {info.remaining !== null && (
              <div>
                Utilisations restantes :{" "}
                <span className="text-ink">
                  {info.remaining}/{info.maxUses}
                </span>
              </div>
            )}
            {info.expiresAt && (
              <div>
                Expire le :{" "}
                <span className="text-ink">
                  {new Date(info.expiresAt).toLocaleDateString("fr-FR", {
                    day: "2-digit", month: "long", year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="font-mono text-xs text-safety bg-safety/10 border-2 border-safety px-3 py-2">
              {error}
            </div>
          )}

          {status === "loading" && (
            <div className="font-mono text-[10px] text-ink/50 uppercase tracking-widest text-center">
              Vérification de votre session…
            </div>
          )}

          {status === "unauthenticated" && (
            <div className="space-y-2">
              <p className="font-mono text-[10px] text-ink/60 uppercase tracking-widest text-center">
                Vous devez être connecté pour accepter
              </p>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                  className="btn-ghost text-center"
                >
                  Se connecter
                </a>
                <a
                  href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                  className="btn-primary text-center"
                >
                  Créer un compte
                </a>
              </div>
            </div>
          )}

          {status === "authenticated" && (
            <>
              <div className="font-mono text-[10px] text-ink/60 uppercase tracking-widest text-center">
                Connecté en tant que{" "}
                <span className="text-ink">
                  {session?.user?.email ?? session?.user?.name}
                </span>
              </div>
              <button
                onClick={accept}
                disabled={accepting}
                className="btn-primary w-full"
              >
                {accepting ? "…" : "Accepter l'invitation"}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
