"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

type NewShare = {
  shareId: string;
  placeId: string;
  placeName: string;
  ownerName: string;
  role: "viewer" | "editor" | "admin";
  receivedAt: string;
};

// We remember in localStorage which shareIds have been dismissed so the user
// doesn't see them again after closing. Fresh shares keep showing until seen.
const DISMISSED_KEY = "boxops-dismissed-shares";

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}
function saveDismissed(set: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export default function NotificationBell() {
  const [items, setItems] = useState<NewShare[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const dismissed = getDismissed();
        const newOnes: NewShare[] = (data.newShares ?? []).filter(
          (s: NewShare) => !dismissed.has(s.shareId)
        );
        setItems(newOnes);
      } catch {
        // silent — non-critical
      }
    }
    load();
    const int = setInterval(load, 60_000); // poll every minute
    return () => {
      cancelled = true;
      clearInterval(int);
    };
  }, []);

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

  function dismiss(shareId: string) {
    const d = getDismissed();
    d.add(shareId);
    saveDismissed(d);
    setItems((prev) => prev.filter((i) => i.shareId !== shareId));
  }

  function dismissAll() {
    const d = getDismissed();
    items.forEach((i) => d.add(i.shareId));
    saveDismissed(d);
    setItems([]);
  }

  async function openPlace(placeId: string, shareId: string) {
    dismiss(shareId);
    await fetch("/api/places/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId }),
    });
    window.location.href = "/";
  }

  const count = items.length;

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          "w-9 h-9 border-2 border-ink shadow-stamp bg-paper relative grid place-items-center",
          "hover:-translate-y-0.5 hover:shadow-stamp-lg transition-transform"
        )}
        aria-label="Notifications"
        title={count > 0 ? `${count} nouveauté(s)` : "Aucune nouveauté"}
      >
        <span className="font-mono text-sm text-ink">🔔</span>
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-safety text-paper font-mono text-[10px] font-bold grid place-items-center border-2 border-paper">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 panel min-w-[300px] z-30 max-h-[400px] overflow-y-auto">
          <div className="px-3 py-2 border-b-2 border-dashed border-ink/15 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink/60">
              Notifications
            </span>
            {count > 0 && (
              <button
                onClick={dismissAll}
                className="font-mono text-[9px] uppercase tracking-widest text-ink/50 hover:text-ink"
              >
                Tout effacer
              </button>
            )}
          </div>

          {count === 0 ? (
            <div className="px-3 py-6 font-mono text-[10px] text-ink/40 uppercase tracking-widest text-center">
              Rien de neuf.
            </div>
          ) : (
            <ul>
              {items.map((s) => (
                <li
                  key={s.shareId}
                  className="px-3 py-2.5 border-b border-dashed border-ink/10 hover:bg-paper-dark cursor-pointer"
                  onClick={() => openPlace(s.placeId, s.shareId)}
                >
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs shrink-0 mt-0.5">📥</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink leading-tight">
                        <span className="font-bold">{s.ownerName}</span> vous a
                        partagé{" "}
                        <span className="font-bold">{s.placeName}</span>
                      </div>
                      <div className="font-mono text-[9px] text-ink/50 uppercase tracking-widest mt-0.5">
                        rôle : {s.role} · cliquez pour ouvrir
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismiss(s.shareId);
                      }}
                      className="font-mono text-xs text-ink/40 hover:text-ink shrink-0"
                      title="Masquer"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
