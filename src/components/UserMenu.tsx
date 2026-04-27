"use client";

import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import clsx from "clsx";
import Link from "next/link";

export default function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  if (status === "loading") {
    return (
      <div className="w-9 h-9 border-2 border-ink shadow-stamp bg-paper grid place-items-center font-mono text-xs text-ink/40">
        …
      </div>
    );
  }
  if (!session?.user) return null;

  const initials = getInitials(
    session.user.name ?? session.user.email ?? "?"
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={clsx(
          "w-9 h-9 border-2 border-ink shadow-stamp bg-ink text-paper",
          "font-mono text-xs font-bold grid place-items-center uppercase",
          "hover:-translate-y-0.5 hover:shadow-stamp-lg transition-transform"
        )}
        aria-label="Menu utilisateur"
        title={session.user.email ?? undefined}
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 panel min-w-[220px] z-30">
          <div className="px-3 py-2 border-b-2 border-dashed border-ink/15">
            {session.user.name && (
              <div className="font-display font-bold text-sm text-ink truncate">
                {session.user.name}
              </div>
            )}
            {session.user.email && (
              <div className="font-mono text-[10px] text-ink/60 truncate">
                {session.user.email}
              </div>
            )}
          </div>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              signOut({ callbackUrl: "/login" });
            }}
            className="w-full text-left px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-ink hover:bg-paper-dark border-b-2 border-dashed border-ink/15"
          >
            ⏻ Se déconnecter
          </button>
          <Link
            href="/forgot-password"
            className="block px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-ink hover:bg-paper-dark border-b-2 border-dashed border-ink/15"
            onMouseDown={(e) => e.preventDefault()}
          >
            🔑 Changer de mot de passe
          </Link>
          <button
            onMouseDown={async (e) => {
              e.preventDefault();
              if (
                !confirm(
                  "Supprimer définitivement votre compte et toutes vos données (lieux, boîtes, plans) ? Cette action est irréversible."
                )
              )
                return;
              await fetch("/api/account", { method: "DELETE" });
              signOut({ callbackUrl: "/login" });
            }}
            className="w-full text-left px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-safety hover:bg-safety/10"
          >
            ✕ Supprimer mon compte
          </button>
        </div>
      )}
    </div>
  );
}

function getInitials(s: string): string {
  const parts = s.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  // Fallback: first two letters of the email local part or the name
  const base = s.split("@")[0];
  return base.slice(0, 2).toUpperCase();
}
