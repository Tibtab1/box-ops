"use client";

import { useEffect, useState, useCallback } from "react";
import clsx from "clsx";

type Props = {
  /** Refresh triggers a re-check of available undo. Parent should bump it after mutations. */
  refreshKey: number;
  /** Called after a successful undo so the parent can refresh the board. */
  onUndone?: () => void;
  /** Disable the button entirely (e.g. viewer role or read-only 3D view). */
  disabled?: boolean;
};

export default function UndoButton({ refreshKey, onUndone, disabled }: Props) {
  const [available, setAvailable] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/undo");
      if (!res.ok) {
        setAvailable(false);
        return;
      }
      const data = await res.json();
      setAvailable(!!data.available);
      setLabel(data.label ?? null);
    } catch {
      setAvailable(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  // Keyboard shortcut: Ctrl+Z / Cmd+Z
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (disabled || busy || !available) return;
      // Ignore if focus is in an input/textarea/contentEditable
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        doUndo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, busy, disabled]);

  async function doUndo() {
    if (busy || !available) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/undo", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Impossible d'annuler.");
        setTimeout(() => setError(null), 3500);
        setBusy(false);
        return;
      }
      onUndone?.();
    } catch {
      setError("Erreur réseau.");
      setTimeout(() => setError(null), 3500);
    } finally {
      setBusy(false);
    }
  }

  if (disabled || !available) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={doUndo}
        disabled={busy}
        title={
          label
            ? `Annuler : ${label} (Ctrl+Z)`
            : "Annuler la dernière action (Ctrl+Z)"
        }
        className={clsx(
          "border-2 border-ink shadow-stamp bg-paper px-2.5 py-1.5",
          "flex items-center gap-1.5",
          "hover:-translate-y-0.5 hover:shadow-stamp-lg transition-transform",
          busy && "opacity-60"
        )}
      >
        <span className="font-mono text-xs">↶</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink">
          Annuler
        </span>
      </button>
      {error && (
        <div className="absolute right-0 top-full mt-1 panel !shadow-stamp !p-2 bg-safety text-paper border-ink font-mono text-[10px] uppercase tracking-widest whitespace-nowrap z-30">
          {error}
        </div>
      )}
    </div>
  );
}
