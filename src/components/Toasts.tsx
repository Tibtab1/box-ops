"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

export type ToastKind = "info" | "success" | "error";

export type ToastMsg = {
  id: number;
  kind: ToastKind;
  text: string;
};

type Props = {
  toasts: ToastMsg[];
  onDismiss: (id: number) => void;
};

export default function Toasts({ toasts, onDismiss }: Props) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMsg; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small delay so the slide-in animation runs
    const t1 = setTimeout(() => setVisible(true), 10);
    // Auto-dismiss after 3s
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 250);
    }, 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDismiss]);

  const toneBg =
    toast.kind === "success"
      ? "bg-blueprint text-paper"
      : toast.kind === "error"
      ? "bg-safety text-paper"
      : "bg-ink text-paper";

  const icon =
    toast.kind === "success" ? "✓" : toast.kind === "error" ? "⚠" : "ℹ";

  return (
    <div
      className={clsx(
        "border-2 border-ink shadow-stamp px-3 py-2 flex items-center gap-2 min-w-[240px] pointer-events-auto",
        "transition-all duration-200",
        visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4",
        toneBg
      )}
      onClick={() => {
        setVisible(false);
        setTimeout(onDismiss, 200);
      }}
    >
      <span className="font-mono text-sm">{icon}</span>
      <span className="font-mono text-[11px] uppercase tracking-[0.15em] flex-1">
        {toast.text}
      </span>
    </div>
  );
}

/** Tiny helper hook to manage toasts from a parent component. */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  function push(kind: ToastKind, text: string) {
    setToasts((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), kind, text },
    ]);
  }

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return { toasts, push, dismiss };
}
