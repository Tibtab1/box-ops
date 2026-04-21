"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

export type ViewMode = "2d" | "3d";

type Props = {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
};

/**
 * Tab-style switch for 2D / 3D views. The caller owns the state; we only
 * persist the last chosen value so that next mount can restore it.
 */
export default function ViewToggle({ mode, onChange }: Props) {
  useEffect(() => {
    try {
      localStorage.setItem("boxops-view", mode);
    } catch {}
  }, [mode]);

  return (
    <div className="flex border-2 border-ink shadow-stamp bg-paper">
      {(["2d", "3d"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={clsx(
            "font-mono text-[10px] uppercase tracking-[0.2em] px-3 py-2 transition-colors",
            mode === m
              ? "bg-ink text-paper"
              : "bg-paper text-ink hover:bg-paper-dark"
          )}
          aria-pressed={mode === m}
          title={m === "2d" ? "Vue 2D plan" : "Vue isométrique 3D"}
        >
          {m === "2d" ? "2D" : "3D"}
        </button>
      ))}
    </div>
  );
}

export function readStoredViewMode(): ViewMode {
  try {
    const v = localStorage.getItem("boxops-view");
    if (v === "3d" || v === "2d") return v;
  } catch {}
  return "2d";
}
