"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";

type Member = {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: "viewer" | "editor" | "admin";
  createdAt: string;
};

type Invitation = {
  id: string;
  kind: "email" | "link";
  role: "viewer" | "editor" | "admin";
  email: string | null;
  token: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
};

type SharesData = {
  owner: { id: string };
  shares: Member[];
  invitations: Invitation[];
};

type Place = {
  id: string;
  name: string;
  isOwner: boolean;
  role: "owner" | "admin" | "editor" | "viewer";
};

export default function PlaceSharesPage() {
  const params = useParams<{ id: string }>();
  const placeId = params.id;

  const [place, setPlace] = useState<Place | null>(null);
  const [data, setData] = useState<SharesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"email" | "link" | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [placeRes, sharesRes] = await Promise.all([
      fetch(`/api/places/${placeId}`).then((r) => r.json()),
      fetch(`/api/places/${placeId}/shares`).then(async (r) => {
        if (!r.ok) return { __error: (await r.json()).error ?? "Erreur" };
        return r.json();
      }),
    ]);
    if (placeRes?.error) {
      setError(placeRes.error);
      setLoading(false);
      return;
    }
    setPlace(placeRes);
    if ("__error" in sharesRes) {
      setError(sharesRes.__error);
    } else {
      setData(sharesRes);
    }
    setLoading(false);
  }, [placeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function removeShare(shareId: string, name: string) {
    if (!confirm(`Retirer l'accès à « ${name} » ?`)) return;
    const res = await fetch(`/api/shares/${shareId}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  async function changeRole(shareId: string, role: string) {
    const res = await fetch(`/api/shares/${shareId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Erreur");
    }
    await load();
  }

  async function revokeInvitation(id: string) {
    if (!confirm("Révoquer cette invitation ?")) return;
    const res = await fetch(`/api/invitations/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center">
        <div className="font-mono text-xs uppercase tracking-widest text-ink/50">Chargement…</div>
      </main>
    );
  }
  if (error || !place || !data) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="panel p-6 max-w-md text-center space-y-3">
          <p className="font-display text-xl text-ink">{error ?? "Erreur."}</p>
          <Link href="/places" className="btn-ghost inline-block">
            ← Retour
          </Link>
        </div>
      </main>
    );
  }

  const canManage = place.isOwner || place.role === "admin";

  return (
    <main className="min-h-screen">
      <header className="border-b-2 border-ink bg-paper/90 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="w-10 h-10 bg-ink grid place-items-center shadow-stamp hover:-translate-y-0.5 transition-transform shrink-0"
            >
              <span className="font-mono text-paper text-lg font-bold">▣</span>
            </Link>
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60 leading-none">
                Partages du lieu
              </div>
              <h1 className="font-display font-black text-ink text-2xl leading-none mt-0.5 truncate">
                {place.name}
              </h1>
            </div>
          </div>
          <Link href="/places" className="btn-ghost">
            ← Tous les lieux
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {!canManage && (
          <div className="panel bg-safety text-paper border-ink p-3 font-mono text-[11px] uppercase tracking-[0.2em] text-center">
            Seul le propriétaire ou un admin peut gérer les partages.
          </div>
        )}

        {/* Members */}
        <section className="panel p-5">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60 mb-3 pb-2 border-b border-dashed border-ink/30">
            Membres · {data.shares.length + 1}
          </h2>
          <ul className="space-y-2">
            {/* Owner (always) */}
            <li className="flex items-center gap-3 p-2 border-2 border-ink bg-paper-dark/40">
              <div className="w-8 h-8 bg-ink text-paper grid place-items-center font-mono text-[10px] font-bold shrink-0">
                {place.isOwner ? "VS" : "--"}
              </div>
              <span className="font-display font-bold text-sm text-ink flex-1 truncate">
                {place.isOwner ? "Vous" : "Propriétaire"}
              </span>
              <span className="stamp-badge bg-ink text-paper border-ink !text-[9px]">
                owner
              </span>
            </li>
            {data.shares.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-2 border-2 border-ink/20">
                <div className="w-8 h-8 border-2 border-ink bg-paper grid place-items-center font-mono text-[10px] font-bold shrink-0">
                  {initials(s.name ?? s.email ?? "?")}
                </div>
                <div className="flex-1 min-w-0">
                  {s.name && (
                    <div className="font-display font-bold text-sm text-ink truncate">
                      {s.name}
                    </div>
                  )}
                  <div className="font-mono text-[10px] text-ink/60 truncate">
                    {s.email}
                  </div>
                </div>
                {canManage ? (
                  <select
                    value={s.role}
                    onChange={(e) => changeRole(s.id, e.target.value)}
                    className="font-mono text-[10px] uppercase tracking-widest border-2 border-ink bg-paper px-2 py-1"
                    disabled={s.role === "admin" && !place.isOwner}
                  >
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                    <option value="admin" disabled={!place.isOwner}>
                      admin
                    </option>
                  </select>
                ) : (
                  <span className="stamp-badge bg-blueprint text-paper border-ink !text-[9px]">
                    {s.role}
                  </span>
                )}
                {canManage && (
                  <button
                    onClick={() => removeShare(s.id, s.name ?? s.email ?? "?")}
                    className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 border-2 border-safety text-safety hover:bg-safety hover:text-paper transition-colors"
                  >
                    Retirer
                  </button>
                )}
              </li>
            ))}
            {data.shares.length === 0 && (
              <li className="font-mono text-[10px] uppercase tracking-widest text-ink/50 text-center py-3">
                Aucun membre invité pour l'instant.
              </li>
            )}
          </ul>
        </section>

        {/* Pending invitations */}
        {data.invitations.length > 0 && (
          <section className="panel p-5">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60 mb-3 pb-2 border-b border-dashed border-ink/30">
              Invitations en attente · {data.invitations.length}
            </h2>
            <ul className="space-y-2">
              {data.invitations.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center gap-3 p-2 border-2 border-dashed border-ink/40"
                >
                  <div className="w-8 h-8 border-2 border-dashed border-ink/40 grid place-items-center text-xs text-ink/50 shrink-0">
                    {i.kind === "email" ? "✉" : "🔗"}
                  </div>
                  <div className="flex-1 min-w-0">
                    {i.kind === "email" ? (
                      <>
                        <div className="font-mono text-[11px] text-ink truncate">
                          {i.email}
                        </div>
                        <div className="font-mono text-[9px] text-ink/50 uppercase tracking-widest">
                          en attente d'inscription
                        </div>
                      </>
                    ) : (
                      <LinkInvitePreview invite={i} />
                    )}
                  </div>
                  <span className="stamp-badge bg-blueprint text-paper border-ink !text-[9px]">
                    {i.role}
                  </span>
                  {canManage && (
                    <button
                      onClick={() => revokeInvitation(i.id)}
                      className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 border-2 border-safety text-safety hover:bg-safety hover:text-paper transition-colors"
                    >
                      Révoquer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Invitation forms */}
        {canManage && (
          <section className="panel p-5 space-y-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60 pb-2 border-b border-dashed border-ink/30">
              Inviter quelqu'un
            </h2>

            {mode === null && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode("email")}
                  className="btn-primary"
                >
                  ✉ Par email
                </button>
                <button onClick={() => setMode("link")} className="btn-primary">
                  🔗 Par lien
                </button>
              </div>
            )}

            {mode === "email" && (
              <InviteEmailForm
                placeId={placeId}
                canAdmin={place.isOwner}
                onDone={async () => {
                  setMode(null);
                  await load();
                }}
                onCancel={() => setMode(null)}
              />
            )}

            {mode === "link" && (
              <InviteLinkForm
                placeId={placeId}
                canAdmin={place.isOwner}
                onDone={async () => {
                  setMode(null);
                  await load();
                }}
                onCancel={() => setMode(null)}
              />
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function initials(s: string): string {
  const parts = s.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.split("@")[0].slice(0, 2).toUpperCase();
}

function LinkInvitePreview({ invite }: { invite: Invitation }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/invite/${invite.token}`
      : `/invite/${invite.token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API denied or unavailable — fall back to selecting the text
      try {
        const el = document.createElement("textarea");
        el.value = url;
        el.setAttribute("readonly", "");
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // give up
      }
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={url}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 font-mono text-[11px] text-ink bg-paper-dark/40 border-2 border-ink/30 px-2 py-1 truncate"
        />
        <button
          onClick={copy}
          className={clsx(
            "font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 border-2 shrink-0 transition-all",
            copied
              ? "bg-blueprint text-paper border-ink"
              : "bg-paper text-ink border-ink hover:-translate-y-0.5 hover:shadow-stamp"
          )}
        >
          {copied ? "✓ Copié" : "📋 Copier"}
        </button>
      </div>
      <div className="font-mono text-[9px] text-ink/50 uppercase tracking-widest mt-1">
        {invite.maxUses !== null
          ? `${invite.usedCount}/${invite.maxUses} utilisations`
          : "usages illimités"}
        {invite.expiresAt &&
          " · expire le " +
            new Date(invite.expiresAt).toLocaleDateString("fr-FR")}
      </div>
    </>
  );
}

function InviteEmailForm({
  placeId,
  canAdmin,
  onDone,
  onCancel,
}: {
  placeId: string;
  canAdmin: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor" | "admin">("viewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/places/${placeId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "email", email, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur.");
        setBusy(false);
        return;
      }
      setSuccess(
        data.immediate
          ? "Accès accordé immédiatement."
          : "Invitation enregistrée — la personne la verra à son inscription."
      );
      setTimeout(onDone, 1200);
    } catch {
      setError("Erreur réseau.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 block mb-1">
          Email
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input-field"
          placeholder="ami@exemple.fr"
        />
      </label>
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 block mb-1">
          Rôle
        </span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className="input-field"
        >
          <option value="viewer">viewer — lecture seule</option>
          <option value="editor">editor — modifier les boîtes</option>
          {canAdmin && (
            <option value="admin">admin — gérer le plan et les partages</option>
          )}
        </select>
      </label>

      {error && (
        <div className="font-mono text-xs text-safety bg-safety/10 border-2 border-safety px-3 py-2">
          {error}
        </div>
      )}
      {success && (
        <div className="font-mono text-xs text-blueprint bg-blueprint/10 border-2 border-blueprint px-3 py-2">
          {success}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost"
          disabled={busy}
        >
          Annuler
        </button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "…" : "Inviter"}
        </button>
      </div>
    </form>
  );
}

function InviteLinkForm({
  placeId,
  canAdmin,
  onDone,
  onCancel,
}: {
  placeId: string;
  canAdmin: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [role, setRole] = useState<"viewer" | "editor" | "admin">("viewer");
  const [singleUse, setSingleUse] = useState(true);
  const [maxUses, setMaxUses] = useState<number>(5);
  const [hasExpiry, setHasExpiry] = useState(true);
  const [expiresDays, setExpiresDays] = useState<number>(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/places/${placeId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "link",
          role,
          maxUses: singleUse ? 1 : maxUses > 1 ? maxUses : null,
          expiresDays: hasExpiry ? expiresDays : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur.");
        setBusy(false);
        return;
      }
      onDone();
    } catch {
      setError("Erreur réseau.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 block mb-1">
          Rôle accordé
        </span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className="input-field"
        >
          <option value="viewer">viewer — lecture seule</option>
          <option value="editor">editor — modifier les boîtes</option>
          {canAdmin && (
            <option value="admin">admin — gérer le plan et les partages</option>
          )}
        </select>
      </label>

      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70">
          Utilisation
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={singleUse}
            onChange={() => setSingleUse(true)}
            className="accent-ink"
          />
          <span className="text-sm text-ink">Usage unique</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={!singleUse}
            onChange={() => setSingleUse(false)}
            className="accent-ink"
          />
          <span className="text-sm text-ink flex items-center gap-2 flex-wrap">
            Multi-utilisation —
            <input
              type="number"
              min={2}
              max={100}
              value={maxUses}
              onChange={(e) => setMaxUses(Math.max(2, parseInt(e.target.value) || 2))}
              disabled={singleUse}
              className={clsx(
                "w-16 border-2 border-ink bg-paper px-2 py-0.5 text-sm",
                singleUse && "opacity-40"
              )}
            />
            utilisations max
          </span>
        </label>
      </div>

      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70">
          Validité
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hasExpiry}
            onChange={(e) => setHasExpiry(e.target.checked)}
            className="accent-ink"
          />
          <span className="text-sm text-ink flex items-center gap-2 flex-wrap">
            Expire dans
            <input
              type="number"
              min={1}
              max={365}
              value={expiresDays}
              onChange={(e) => setExpiresDays(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={!hasExpiry}
              className={clsx(
                "w-16 border-2 border-ink bg-paper px-2 py-0.5 text-sm",
                !hasExpiry && "opacity-40"
              )}
            />
            jour(s)
          </span>
        </label>
      </div>

      {error && (
        <div className="font-mono text-xs text-safety bg-safety/10 border-2 border-safety px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost"
          disabled={busy}
        >
          Annuler
        </button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "…" : "Générer le lien"}
        </button>
      </div>
    </form>
  );
}
