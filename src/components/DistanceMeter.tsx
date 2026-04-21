"use client";

import { useMemo, useState } from "react";
import { gridDistance } from "@/lib/types";

type BoxLite = {
  id: string;
  name: string;
  color: string;
  location: { code: string; row: number; col: number } | null;
};

type Props = {
  boxes: BoxLite[];
  endpoints: { a: string | null; b: string | null };
  onEndpointsChange: (e: { a: string | null; b: string | null }) => void;
};

export default function DistanceMeter({
  boxes,
  endpoints,
  onEndpointsChange,
}: Props) {
  const [open, setOpen] = useState(false);

  const placed = useMemo(
    () =>
      boxes
        .filter((b) => !!b.location)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [boxes]
  );

  const boxA = placed.find((b) => b.id === endpoints.a) ?? null;
  const boxB = placed.find((b) => b.id === endpoints.b) ?? null;

  const distance =
    boxA?.location && boxB?.location
      ? gridDistance(boxA.location, boxB.location)
      : null;

  return (
    <div className="panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 border-b-2 border-ink/10 hover:bg-paper-dark/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] bg-blueprint text-paper px-2 py-1 border-2 border-ink">
            ⇄ Distance
          </span>
          <span className="font-display font-bold text-ink">
            Mesurer entre deux boîtes
          </span>
        </div>
        <span className="font-mono text-xs">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="p-4 space-y-3 reveal">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PickBox
              label="Point A"
              value={endpoints.a}
              boxes={placed}
              excludeId={endpoints.b}
              onChange={(id) =>
                onEndpointsChange({ ...endpoints, a: id })
              }
            />
            <PickBox
              label="Point B"
              value={endpoints.b}
              boxes={placed}
              excludeId={endpoints.a}
              onChange={(id) =>
                onEndpointsChange({ ...endpoints, b: id })
              }
            />
          </div>

          {boxA && boxB && distance !== null && (
            <div className="border-t-2 border-dashed border-ink/30 pt-3 mt-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60 mb-1">
                Distance Manhattan
              </div>
              <div className="flex items-end gap-2 flex-wrap">
                <span className="font-display font-black text-5xl leading-none text-ink">
                  {distance}
                </span>
                <span className="font-mono text-xs uppercase tracking-widest text-ink/70 pb-1">
                  pas · {boxA.location!.code} → {boxB.location!.code}
                </span>
              </div>
              <p className="text-xs text-ink/60 mt-2 font-mono">
                {distance === 0
                  ? "Même emplacement."
                  : distance === 1
                  ? "Voisins immédiats."
                  : `${distance} cellules d'écart en parcours orthogonal.`}
              </p>
            </div>
          )}

          {(endpoints.a || endpoints.b) && (
            <button
              type="button"
              onClick={() => onEndpointsChange({ a: null, b: null })}
              className="btn-ghost w-full"
            >
              Réinitialiser
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PickBox({
  label,
  value,
  boxes,
  excludeId,
  onChange,
}: {
  label: string;
  value: string | null;
  boxes: BoxLite[];
  excludeId: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 block mb-1.5">
        {label}
      </span>
      <select
        className="input-field"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">— Choisir —</option>
        {boxes
          .filter((b) => b.id !== excludeId)
          .map((b) => (
            <option key={b.id} value={b.id}>
              {b.location?.code} · {b.name}
            </option>
          ))}
      </select>
    </label>
  );
}
