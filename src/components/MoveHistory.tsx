"use client";

import { useEffect, useState } from "react";

type Move = {
  id: string;
  fromCode: string | null;
  toCode: string | null;
  fromStackIndex: number | null;
  toStackIndex: number | null;
  reason: "create" | "move" | "detach" | "reorder";
  createdAt: string;
};

type Props = {
  boxId: string;
};

export default function MoveHistory({ boxId }: Props) {
  const [moves, setMoves] = useState<Move[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || moves !== null) return;
    fetch(`/api/boxes/${boxId}/history`)
      .then((r) => r.json())
      .then(setMoves);
  }, [open, boxId, moves]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60 mb-2 pb-2 border-b border-dashed border-ink/30 hover:text-ink transition-colors"
      >
        <span>Historique</span>
        <span>{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-2 reveal">
          {moves === null ? (
            <div className="font-mono text-[10px] text-ink/40">Chargement…</div>
          ) : moves.length === 0 ? (
            <div className="font-mono text-[10px] text-ink/40">
              Aucun déplacement enregistré.
            </div>
          ) : (
            <ol className="space-y-1.5">
              {moves.map((m) => (
                <MoveItem key={m.id} move={m} />
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function MoveItem({ move }: { move: Move }) {
  const date = new Date(move.createdAt);
  const dateStr = date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
  const timeStr = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const { label, arrow, tone } = describeMove(move);

  return (
    <li className="flex items-start gap-2 text-xs">
      <span
        className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 border-2 shrink-0 ${
          tone === "create"
            ? "bg-blueprint text-paper border-ink"
            : tone === "detach"
            ? "bg-safety text-paper border-ink"
            : "bg-ink text-paper border-ink"
        }`}
      >
        {label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[11px] text-ink leading-tight">
          {arrow}
        </div>
        <div className="font-mono text-[9px] text-ink/50 mt-0.5">
          {dateStr} · {timeStr}
        </div>
      </div>
    </li>
  );
}

function describeMove(m: Move): {
  label: string;
  arrow: string;
  tone: "create" | "move" | "detach";
} {
  if (m.reason === "create") {
    return {
      label: "Créée",
      arrow: m.toCode
        ? `Placée à ${m.toCode}${m.toStackIndex != null ? ` (#${m.toStackIndex + 1})` : ""}`
        : "Sans emplacement",
      tone: "create",
    };
  }
  if (m.reason === "detach" || !m.toCode) {
    return {
      label: "Retirée",
      arrow: m.fromCode ? `Depuis ${m.fromCode}` : "",
      tone: "detach",
    };
  }
  return {
    label: "Déplacée",
    arrow: `${m.fromCode ?? "∅"} → ${m.toCode}`,
    tone: "move",
  };
}
