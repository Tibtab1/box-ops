"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import MoveHistory from "./MoveHistory";
import { FLAT_TYPE_LABELS, type FlatType } from "@/lib/types";

type BoxDetail = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  color: string;
  photoUrl: string | null;
  stackIndex: number;
  location: { code: string; row: number; col: number } | null;
  kind?: "box" | "furniture" | "flat";
  // Flat-specific
  widthCm?: number | null;
  heightCm?: number | null;
  flatType?: FlatType | null;
  isFragile?: boolean;
  estimatedValueCents?: number | null;
  flatEdgeRowA?: number | null;
  flatEdgeColA?: number | null;
  flatEdgeRowB?: number | null;
  flatEdgeColB?: number | null;
};

type NeighborBox = {
  id: string;
  name: string;
  color: string;
  location: { code: string } | null;
  stackSize?: number;
} | null;

type Neighbors = {
  left: NeighborBox;
  right: NeighborBox;
  front: NeighborBox;
  back: NeighborBox;
};

type StackEntry = {
  id: string;
  name: string;
  color: string;
  stackIndex: number;
  isSelf: boolean;
};

type Props = {
  boxId: string;
  onClose: () => void;
  /** When undefined, the Edit button is hidden (read-only mode). */
  onEdit?: (id: string) => void;
  onDeleted: () => void;
  /** When false, hides the Delete button. */
  canDelete?: boolean;
  onJumpToBox: (id: string) => void;
};

export default function BoxDetailPanel({
  boxId,
  onClose,
  onEdit,
  onDeleted,
  canDelete = true,
  onJumpToBox,
}: Props) {
  const [box, setBox] = useState<BoxDetail | null>(null);
  const [neighbors, setNeighbors] = useState<Neighbors | null>(null);
  const [stack, setStack] = useState<StackEntry[]>([]);
  const [capacity, setCapacity] = useState(0);
  const [loading, setLoading] = useState(true);

  const readOnly = !onEdit && !canDelete;

  const load = useCallback(async () => {
    const res = await fetch(`/api/boxes/${boxId}`);
    const data = await res.json();
    setBox(data.box);
    setNeighbors(data.neighbors);
    setStack(data.stack ?? []);
    setCapacity(data.capacity ?? 0);
    setLoading(false);
  }, [boxId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function handleDelete() {
    if (!box) return;
    if (!confirm(`Supprimer « ${box.name} » ? Cette action est définitive.`))
      return;
    await fetch(`/api/boxes/${box.id}`, { method: "DELETE" });
    onDeleted();
  }

  async function reorder(direction: "up" | "down") {
    if (!box) return;
    await fetch(`/api/boxes/${box.id}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    await load();
  }

  if (loading || !box) {
    return (
      <aside className="panel p-6 reveal">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50">
          Chargement…
        </div>
      </aside>
    );
  }

  const atTop = stack.length > 0 && stack[stack.length - 1].id === box.id;
  const atBottom = stack.length > 0 && stack[0].id === box.id;

  // In read-only mode we also hide the stack reorder buttons (they mutate data)
  const showReorder = !readOnly;

  return (
    <aside className="panel p-5 sm:p-6 reveal">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-12 h-12 border-2 border-ink shadow-stamp shrink-0"
            style={{ backgroundColor: box.color }}
            aria-hidden
          />
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
              {box.kind === "flat" ? "Fiche cadre" : "Fiche boîte"}{readOnly && " · lecture seule"}
            </div>
            <h3 className="font-display text-2xl font-black text-ink leading-tight break-words">
              {box.name}
            </h3>
          </div>
        </div>
        <button
          onClick={onClose}
          className="btn-ghost !px-2.5 !py-1.5 shrink-0"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      {box.kind === "flat" ? (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="stamp-badge bg-blueprint text-paper border-ink">
            ⊞ Arête R{box.flatEdgeRowA}:{box.flatEdgeColA}
            {box.flatEdgeRowB != null ? ` → R${box.flatEdgeRowB}:${box.flatEdgeColB}` : " (bord)"}
          </span>
        </div>
      ) : box.location ? (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="stamp-badge bg-ink text-paper border-ink">
            ◉ {box.location.code}
          </span>
          {stack.length > 1 && (
            <span className="stamp-badge bg-blueprint text-paper border-ink">
              Niveau {box.stackIndex + 1}/{stack.length}
            </span>
          )}
        </div>
      ) : (
        <div className="stamp-badge bg-safety text-paper border-ink mb-4">
          ⚠ Aucun emplacement
        </div>
      )}

      {box.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={box.photoUrl}
          alt={box.name}
          className="w-full aspect-[4/3] object-cover border-2 border-ink shadow-stamp mb-4"
        />
      )}

      {box.description && (
        <p className="text-sm text-ink/85 leading-relaxed mb-4 whitespace-pre-wrap">
          {box.description}
        </p>
      )}

      {box.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {box.tags.map((t) => (
            <span key={t} className="label-tag">
              #{t}
            </span>
          ))}
        </div>
      )}

      {stack.length > 1 && (
        <div className="mb-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60 mb-2 pb-2 border-b border-dashed border-ink/30 flex items-center justify-between">
            <span>Pile — {stack.length} boîtes</span>
            <span className="text-ink/50">Capacité {capacity}</span>
          </div>
          <ol className="space-y-1">
            {[...stack].reverse().map((s) => (
              <li
                key={s.id}
                onClick={() => !s.isSelf && onJumpToBox(s.id)}
                className={clsx(
                  "flex items-center gap-2 p-1.5 border-2 transition-colors",
                  s.isSelf
                    ? "border-safety bg-safety/10"
                    : "border-ink/20 hover:border-ink hover:bg-paper-dark/50 cursor-pointer"
                )}
              >
                <span className="font-mono text-[10px] text-ink/60 w-6 text-center">
                  {s.stackIndex + 1}
                </span>
                <span
                  className="w-4 h-4 border-2 border-ink shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="font-display font-bold text-sm text-ink truncate flex-1">
                  {s.name}
                </span>
                {s.isSelf && (
                  <span className="font-mono text-[9px] uppercase tracking-wider text-safety">
                    ← ici
                  </span>
                )}
              </li>
            ))}
          </ol>
          {showReorder && (
            <>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  disabled={atTop}
                  onClick={() => reorder("up")}
                  className="btn-ghost !text-[10px]"
                >
                  ↑ Monter
                </button>
                <button
                  disabled={atBottom}
                  onClick={() => reorder("down")}
                  className="btn-ghost !text-[10px]"
                >
                  ↓ Descendre
                </button>
              </div>
              <p className="font-mono text-[10px] text-ink/50 uppercase tracking-widest mt-2">
                Haut de pile = plus accessible
              </p>
            </>
          )}
        </div>
      )}

      {box.location && neighbors && (
        <div className="mb-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60 mb-2 pb-2 border-b border-dashed border-ink/30">
            Voisins immédiats
          </div>
          <NeighborCompass
            neighbors={neighbors}
            onJumpToBox={onJumpToBox}
            center={box.name}
          />
          <p className="font-mono text-[10px] text-ink/50 uppercase tracking-widest mt-2">
            Montre la boîte du dessus de chaque pile voisine.
          </p>
        </div>
      )}

      {box.kind === "flat" && (
        <div className="mb-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60 mb-2 pb-2 border-b border-dashed border-ink/30">
            Informations cadre
          </div>
          <dl className="space-y-1.5">
            {box.flatType && (
              <div className="flex justify-between font-mono text-[11px]">
                <dt className="text-ink/60">Type</dt>
                <dd className="font-bold">{FLAT_TYPE_LABELS[box.flatType] ?? box.flatType}</dd>
              </div>
            )}
            {box.widthCm != null && box.heightCm != null && (
              <div className="flex justify-between font-mono text-[11px]">
                <dt className="text-ink/60">Dimensions</dt>
                <dd className="font-bold">{box.widthCm} × {box.heightCm} cm</dd>
              </div>
            )}
            {box.estimatedValueCents != null && (
              <div className="flex justify-between font-mono text-[11px]">
                <dt className="text-ink/60">Valeur estimée</dt>
                <dd className="font-bold">{(box.estimatedValueCents / 100).toFixed(2)} €</dd>
              </div>
            )}
            {box.isFragile && (
              <div className="flex justify-between font-mono text-[11px]">
                <dt className="text-ink/60">Fragile</dt>
                <dd className="font-bold text-safety">⚠ Oui</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {box.kind !== "flat" && (
        <div className="mb-5">
          <MoveHistory boxId={box.id} />
        </div>
      )}

      {/* Action buttons — hidden entirely in read-only */}
      {(onEdit || canDelete) && (
        <div
          className={clsx(
            "grid gap-2",
            onEdit && canDelete ? "grid-cols-2" : "grid-cols-1"
          )}
        >
          {onEdit && (
            <button onClick={() => onEdit(box.id)} className="btn-primary">
              Modifier
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete} className="btn-safety">
              Supprimer
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

function NeighborCompass({
  neighbors,
  onJumpToBox,
  center,
}: {
  neighbors: Neighbors;
  onJumpToBox: (id: string) => void;
  center: string;
}) {
  const slots: {
    key: keyof Neighbors;
    label: string;
    arrow: string;
    col: string;
    row: string;
  }[] = [
    { key: "back", label: "Derrière", arrow: "↑", col: "col-start-2", row: "row-start-1" },
    { key: "left", label: "Gauche", arrow: "←", col: "col-start-1", row: "row-start-2" },
    { key: "right", label: "Droite", arrow: "→", col: "col-start-3", row: "row-start-2" },
    { key: "front", label: "Devant", arrow: "↓", col: "col-start-2", row: "row-start-3" },
  ];

  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
      <div className="col-start-2 row-start-2 bg-ink text-paper font-mono text-[10px] uppercase tracking-widest grid place-items-center text-center p-2 border-2 border-ink aspect-square leading-tight">
        {center.slice(0, 10)}
        {center.length > 10 && "…"}
      </div>

      {slots.map((s) => {
        const n = neighbors[s.key];
        return (
          <div key={s.key} className={clsx(s.col, s.row, "aspect-square")}>
            {n ? (
              <button
                type="button"
                onClick={() => onJumpToBox(n.id)}
                className="w-full h-full border-2 border-ink shadow-stamp p-1.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-stamp-lg flex flex-col justify-between relative"
                style={{ backgroundColor: n.color }}
              >
                <span className="font-mono text-[9px] uppercase tracking-wider text-paper/90">
                  {s.arrow} {s.label}
                </span>
                <span className="font-mono text-[10px] font-bold text-paper leading-tight line-clamp-2">
                  {n.name}
                </span>
                {n.location && (
                  <span className="font-mono text-[9px] text-paper/80">
                    {n.location.code}
                  </span>
                )}
                {n.stackSize && n.stackSize > 1 && (
                  <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-ink text-paper font-mono text-[9px] font-bold grid place-items-center border-2 border-paper">
                    ×{n.stackSize}
                  </span>
                )}
              </button>
            ) : (
              <div className="w-full h-full border-2 border-dashed border-ink/30 grid place-items-center text-center p-1">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-ink/40">
                    {s.arrow} {s.label}
                  </div>
                  <div className="font-mono text-[9px] text-ink/30 mt-0.5">∅</div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
