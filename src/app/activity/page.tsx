"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

type MoveEvent = {
  kind: "move";
  id: string;
  boxName: string;
  boxColor: string;
  boxKind: string;
  fromCode: string | null;
  toCode: string | null;
  reason: string;
  createdAt: string;
};

type PlanEvent = {
  kind: "plan";
  id: string;
  action: string;
  detail: unknown;
  userName: string;
  createdAt: string;
};

type ActivityEvent = MoveEvent | PlanEvent;

const ACTION_LABELS: Record<string, string> = {
  add_cell_right: "+ cellule à droite",
  add_cell_left: "+ cellule à gauche",
  remove_cell_right: "− cellule à droite",
  remove_cell_left: "− cellule à gauche",
  add_row: "+ rangée",
  remove_row: "− rangée",
  reset_plan: "Plan réinitialisé",
};

const KIND_ICON: Record<string, string> = {
  box: "📦",
  furniture: "🪑",
  flat: "🖼",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MoveRow({ ev }: { ev: MoveEvent }) {
  const icon = KIND_ICON[ev.boxKind] ?? "📦";
  return (
    <div className="flex items-start gap-3 p-3 border-2 border-ink shadow-stamp bg-paper hover:bg-paper-dark transition-colors">
      <span
        className="w-4 h-4 shrink-0 mt-0.5 border border-ink"
        style={{ backgroundColor: ev.boxColor }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm shrink-0" aria-hidden>{icon}</span>
          <span className="font-display font-bold text-ink truncate">{ev.boxName}</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-ink/50 bg-paper-dark px-1.5 py-0.5 border border-ink/20 shrink-0">
            {ev.fromCode ?? "·"} → {ev.toCode ?? "·"}
          </span>
          {ev.reason && ev.reason !== "drop" && (
            <span className="font-mono text-[9px] uppercase tracking-widest text-ink/40 shrink-0">
              {ev.reason}
            </span>
          )}
        </div>
      </div>
      <time
        className="font-mono text-[9px] uppercase tracking-widest text-ink/40 shrink-0 whitespace-nowrap mt-0.5"
        dateTime={ev.createdAt}
      >
        {formatDate(ev.createdAt)}
      </time>
    </div>
  );
}

function PlanRow({ ev }: { ev: PlanEvent }) {
  const label = ACTION_LABELS[ev.action] ?? ev.action;
  const isReset = ev.action === "reset_plan";
  return (
    <div
      className={clsx(
        "flex items-start gap-3 p-3 border-2 shadow-stamp transition-colors",
        isReset
          ? "border-safety bg-safety/10 hover:bg-safety/20"
          : "border-ink/40 bg-paper hover:bg-paper-dark"
      )}
    >
      <span className="font-mono text-[11px] text-ink/50 mt-0.5 shrink-0">✎</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={clsx(
              "font-mono text-[10px] uppercase tracking-widest font-bold",
              isReset ? "text-safety" : "text-ink"
            )}
          >
            {label}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-ink/40">
            par {ev.userName}
          </span>
        </div>
      </div>
      <time
        className="font-mono text-[9px] uppercase tracking-widest text-ink/40 shrink-0 whitespace-nowrap mt-0.5"
        dateTime={ev.createdAt}
      >
        {formatDate(ev.createdAt)}
      </time>
    </div>
  );
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/activity")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => {
        setEvents(data as ActivityEvent[]);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  const moveCount = events.filter((e) => e.kind === "move").length;
  const planCount = events.filter((e) => e.kind === "plan").length;

  return (
    <main className="min-h-screen">
      <header className="border-b-2 border-ink bg-paper/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="font-mono text-[10px] uppercase tracking-widest text-ink/50 hover:text-ink transition-colors"
            >
              ← BOX·OPS
            </a>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60">
              Historique
            </div>
            <h1 className="font-display font-black text-ink text-2xl leading-none mt-0.5">
              Activité
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest border-2 border-ink px-2.5 py-1 bg-blueprint text-paper">
              {moveCount} déplacements
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest border-2 border-ink px-2.5 py-1 bg-ink text-paper">
              {planCount} modif. plan
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {loading && (
          <div className="font-mono text-xs uppercase tracking-widest text-ink/40 text-center py-16">
            Chargement…
          </div>
        )}
        {error && (
          <div className="panel bg-safety text-paper p-4 font-mono text-xs uppercase tracking-widest text-center">
            Erreur : {error}
          </div>
        )}
        {!loading && !error && events.length === 0 && (
          <div className="font-mono text-xs uppercase tracking-widest text-ink/40 text-center py-16">
            Aucune activité pour l&apos;instant.
          </div>
        )}
        {!loading && !error && events.length > 0 && (
          <div className="space-y-1.5">
            {events.map((ev) =>
              ev.kind === "move" ? (
                <MoveRow key={ev.id} ev={ev} />
              ) : (
                <PlanRow key={ev.id} ev={ev as PlanEvent} />
              )
            )}
            <p className="font-mono text-[9px] uppercase tracking-widest text-ink/30 text-center pt-4">
              50 derniers événements
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
