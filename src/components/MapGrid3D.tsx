"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  project,
  tileTopPolygon,
  boxFrontPolygon,
  boxRightPolygon,
  boxTopPolygon,
  shadeHex,
  renderDepth,
} from "@/lib/iso";
import type { CellView, FlatEdgeItem } from "@/lib/types";

type Props = {
  cells: CellView[];
  flats?: FlatEdgeItem[];
  selectedCode?: string | null;
  highlightedCodes?: Set<string>;
  onCellClick?: (cell: CellView) => void;
  /** If true, clicks on empty/aisle cells do nothing. Only box cells remain clickable. */
  readOnly?: boolean;
};

type HoverInfo = {
  cellCode: string;
  hoveredIdx: number; // which box is under the pointer
  stack: Array<{
    id: string;
    name: string;
    color: string;
    stackIndex: number;
    tags: string[];
  }>;
  capacity: number;
  sx: number;
  sy: number;
};

export default function MapGrid3D({
  cells,
  flats = [],
  selectedCode,
  highlightedCodes,
  onCellClick,
  readOnly,
}: Props) {
  // ─── Grid bounds ──────────────────────────────────────────────────
  const bounds = useMemo(() => {
    if (cells.length === 0)
      return { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 };
    return {
      minCol: Math.min(...cells.map((c) => c.col)),
      maxCol: Math.max(...cells.map((c) => c.col)),
      minRow: Math.min(...cells.map((c) => c.row)),
      maxRow: Math.max(...cells.map((c) => c.row)),
    };
  }, [cells]);

  // ─── Explode & isolation state ────────────────────────────────────
  const [explode, setExplode] = useState(0); // 0 = compact, 1 = fully exploded
  const [isolatedRow, setIsolatedRow] = useState<number | null>(null);

  // List of unique row numbers for the isolation picker
  const rowNumbers = useMemo(
    () => [...new Set(cells.map((c) => c.row))].sort((a, b) => a - b),
    [cells]
  );

  // Cells to render: filter by isolation
  const visibleCells = useMemo(
    () => (isolatedRow === null ? cells : cells.filter((c) => c.row === isolatedRow)),
    [cells, isolatedRow]
  );

  // ─── Viewbox ──────────────────────────────────────────────────────
  const viewBox = useMemo(() => {
    if (cells.length === 0) return { x: -200, y: -200, w: 400, h: 400 };
    const maxStack = Math.max(1, ...cells.map((c) => c.boxes.length));
    // Account for explode: vertical extension + horizontal spread
    const effectiveStack = maxStack * (1 + explode * 1.5);
    const maxColOff = (maxStack - 1) * explode * 0.3;
    const pts: Array<{ sx: number; sy: number }> = [];
    for (let r = bounds.minRow; r <= bounds.maxRow + 1; r++) {
      for (let c = bounds.minCol; c <= bounds.maxCol + 1; c++) {
        pts.push(project(c, r, 0));
        pts.push(project(c, r, effectiveStack));
        pts.push(project(c + maxColOff, r, 0));
        pts.push(project(c + maxColOff, r, effectiveStack));
      }
    }
    const xs = pts.map((p) => p.sx);
    const ys = pts.map((p) => p.sy);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const PAD = 40;
    return {
      x: minX - PAD,
      y: minY - PAD,
      w: maxX - minX + PAD * 2,
      h: maxY - minY + PAD * 2,
    };
  }, [cells, bounds, explode]);

  // ─── Zoom & pan ───────────────────────────────────────────────────
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    tx0: number;
    ty0: number;
    movedPx: number;
  } | null>(null);
  const pinchState = useRef<{ dist0: number; scale0: number } | null>(null);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const next = Math.max(0.3, Math.min(4, scale * dir));
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      setScale(next);
      return;
    }
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    const ratio = next / scale;
    setTx((v) => cx - (cx - v) * ratio);
    setTy((v) => cy - (cy - v) * ratio);
    setScale(next);
  }

  function onPointerDown(e: React.PointerEvent) {
    const target = e.target as Element;
    if (target.closest("[data-iso-box]")) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      tx0: tx,
      ty0: ty,
      movedPx: 0,
    };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragState.current;
    if (d?.active) {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      d.movedPx = Math.max(d.movedPx, Math.abs(dx) + Math.abs(dy));
      setTx(d.tx0 + dx);
      setTy(d.ty0 + dy);
    }
  }
  function onPointerUp() {
    dragState.current = null;
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchState.current = {
        dist0: Math.sqrt(dx * dx + dy * dy),
        scale0: scale,
      };
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchState.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.sqrt(dx * dx + dy * dy);
      const next = Math.max(
        0.3,
        Math.min(4, pinchState.current.scale0 * (d / pinchState.current.dist0))
      );
      setScale(next);
    }
  }
  function onTouchEnd() {
    pinchState.current = null;
  }

  function resetView() {
    setTx(0);
    setTy(0);
    setScale(1);
  }

  // ─── Hover ────────────────────────────────────────────────────────
  const [hover, setHover] = useState<HoverInfo | null>(null);
  function clearHover() {
    setHover(null);
  }

  // ─── Stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const storage = cells.filter((c) => c.type === "cell" && c.enabled);
    const occ = storage.filter((c) => c.boxes.length > 0).length;
    return {
      rows: bounds.maxRow - bounds.minRow + 1,
      cells: storage.length,
      occ,
    };
  }, [cells, bounds]);

  // ─── Render items sorted back-to-front ────────────────────────────
  // The explode factor adds a vertical gap between stacked boxes so you can
  // peek between them. Effective z positions take `explode` into account.
  type FloorTile = { kind: "floor"; cell: CellView; depth: number };
  type BoxTile = {
    kind: "box";
    cell: CellView;
    boxIdx: number;
    depth: number;
    zBottom: number;
    zTop: number;
    colOff: number;
  };
  type FlatTile = { kind: "flat"; flat: FlatEdgeItem; depth: number };
  type Item = FloorTile | BoxTile | FlatTile;

  // Set of "row,col" for visible cells — used by FlatSlab to resolve outer edges.
  const cellSet = useMemo(
    () => new Set(visibleCells.map((c) => `${c.row},${c.col}`)),
    [visibleCells]
  );

  const items: Item[] = useMemo(() => {
    const acc: Item[] = [];
    const boxHeight = 1; // one stack unit per box
    const gap = explode * 1.5;       // vertical gap between layers
    const spread = explode * 0.3;    // horizontal spread per stack level

    for (const cell of visibleCells) {
      acc.push({
        kind: "floor",
        cell,
        depth: renderDepth(cell.col, cell.row, 0) - 1,
      });
      for (let i = 0; i < cell.boxes.length; i++) {
        const zBottom = i * (boxHeight + gap);
        const zTop = zBottom + boxHeight;
        const colOff = i * spread;
        acc.push({
          kind: "box",
          cell,
          boxIdx: i,
          depth: renderDepth(cell.col, cell.row, i + 1),
          zBottom,
          zTop,
          colOff,
        });
      }
    }

    for (const f of flats) {
      // Depth: use the "foreground" boundary of the edge so the slab renders
      // after both adjacent floor tiles but before boxes above floor level.
      const depth =
        (Math.max(f.colA, f.colB ?? f.colA) +
          Math.max(f.rowA, f.rowB ?? f.rowA) +
          1) *
          1000 -
        0.5;
      acc.push({ kind: "flat", flat: f, depth });
    }

    return acc.sort((a, b) => a.depth - b.depth);
  }, [visibleCells, explode, flats]);

  // ─── Empty state ──────────────────────────────────────────────────
  if (cells.length === 0) {
    return (
      <div className="panel p-10 text-center">
        <div className="font-mono text-xs uppercase tracking-widest text-ink/60">
          Plan vide
        </div>
        <p className="font-display text-xl text-ink mt-2">
          Ajoutez des cellules pour voir la vue 3D.
        </p>
      </div>
    );
  }

  return (
    <div className="panel p-0 overflow-hidden relative">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b-2 border-dashed border-ink/40 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60">
            Vue isométrique · 3D {readOnly && "· lecture seule"}
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-black text-ink leading-none mt-1">
            Box n°1
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-mono uppercase tracking-[0.15em] text-ink/70">
          <span>
            {stats.rows} rangée{stats.rows > 1 ? "s" : ""} · {stats.occ}/{stats.cells} occupées
          </span>
          <span className="flex items-center gap-2">
            <span>zoom {Math.round(scale * 100)}%</span>
            <button
              onClick={resetView}
              className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 border-2 border-ink/30 hover:border-ink"
            >
              ↻ Recentrer
            </button>
          </span>
        </div>
      </div>

      {/* Inspector toolbar — the "X-ray" controls */}
      <div className="px-4 sm:px-6 py-3 border-b-2 border-dashed border-ink/30 flex flex-wrap items-center gap-x-5 gap-y-3 bg-paper-dark/30">
        {/* Explode slider */}
        <label className="flex items-center gap-2 min-w-[180px]">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 shrink-0">
            ⇅ Éclatement
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={explode * 100}
            onChange={(e) => setExplode(parseInt(e.target.value, 10) / 100)}
            className="flex-1 accent-safety"
            aria-label="Éclatement des piles"
          />
          <span className="font-mono text-[10px] text-ink/50 w-8 text-right tabular-nums">
            {Math.round(explode * 100)}%
          </span>
        </label>

        {/* Row isolator */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70">
            ◎ Isoler
          </span>
          <button
            onClick={() => setIsolatedRow(null)}
            className={clsx(
              "font-mono text-[10px] uppercase tracking-widest px-2 py-1 border-2 transition-all",
              isolatedRow === null
                ? "bg-ink text-paper border-ink shadow-stamp"
                : "border-ink/30 text-ink/70 hover:border-ink"
            )}
          >
            Tout
          </button>
          {rowNumbers.map((r) => (
            <button
              key={r}
              onClick={() => setIsolatedRow(r)}
              className={clsx(
                "font-mono text-[10px] uppercase tracking-widest px-2 py-1 border-2 transition-all",
                isolatedRow === r
                  ? "bg-blueprint text-paper border-ink shadow-stamp"
                  : "border-ink/30 text-ink/70 hover:border-ink"
              )}
            >
              R{r}
            </button>
          ))}
        </div>
      </div>

      {/* Zoom buttons */}
      <div className="absolute top-32 right-4 z-20 flex flex-col gap-1.5">
        <button
          onClick={() => setScale((s) => Math.min(4, s * 1.2))}
          className="w-9 h-9 border-2 border-ink bg-paper shadow-stamp font-mono text-lg grid place-items-center hover:-translate-y-0.5 hover:shadow-stamp-lg transition-transform"
          aria-label="Zoom +"
        >
          +
        </button>
        <button
          onClick={() => setScale((s) => Math.max(0.3, s / 1.2))}
          className="w-9 h-9 border-2 border-ink bg-paper shadow-stamp font-mono text-lg grid place-items-center hover:-translate-y-0.5 hover:shadow-stamp-lg transition-transform"
          aria-label="Zoom −"
        >
          −
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative w-full h-[560px] sm:h-[640px] cursor-grab active:cursor-grabbing overflow-hidden select-none touch-none"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={clearHover}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={resetView}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <defs>
            <pattern
              id="hatch"
              patternUnits="userSpaceOnUse"
              width="6"
              height="6"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill="var(--paper)" />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="6"
                stroke="color-mix(in srgb, var(--ink) 25%, transparent)"
                strokeWidth="1.2"
              />
            </pattern>
          </defs>

          <FloorBackdrop bounds={bounds} />

          {items.map((item) => {
            if (item.kind === "floor") {
              return (
                <FloorCell
                  key={`f-${item.cell.id}`}
                  cell={item.cell}
                  isSelected={selectedCode === item.cell.code}
                  isHighlighted={highlightedCodes?.has(item.cell.code)}
                  onClick={() => {
                    // In readOnly mode, only allow clicking cells that have at least one box
                    if (readOnly && item.cell.boxes.length === 0) return;
                    onCellClick?.(item.cell);
                  }}
                  clickable={
                    !!onCellClick && (!readOnly || item.cell.boxes.length > 0)
                  }
                />
              );
            }
            if (item.kind === "flat") {
              return (
                <FlatSlab
                  key={`flat-${item.flat.id}`}
                  flat={item.flat}
                  cellSet={cellSet}
                />
              );
            }
            const box = item.cell.boxes[item.boxIdx];
            return (
              <BoxCube
                key={`b-${box.id}`}
                col={item.cell.col + item.colOff}
                row={item.cell.row}
                zBottom={item.zBottom}
                zTop={item.zTop}
                color={box.color}
                isTop={item.boxIdx === item.cell.boxes.length - 1}
                isSelected={selectedCode === item.cell.code}
                isHighlighted={highlightedCodes?.has(item.cell.code)}
                isHovered={
                  hover?.cellCode === item.cell.code &&
                  hover.hoveredIdx === item.boxIdx
                }
                onClick={(e) => {
                  if (dragState.current && dragState.current.movedPx > 5) return;
                  e.stopPropagation();
                  onCellClick?.(item.cell);
                }}
                onHover={(sx, sy) =>
                  setHover({
                    cellCode: item.cell.code,
                    hoveredIdx: item.boxIdx,
                    stack: item.cell.boxes.map((b) => ({
                      id: b.id,
                      name: b.name,
                      color: b.color,
                      stackIndex: b.stackIndex,
                      tags: b.tags,
                    })),
                    capacity: item.cell.capacity,
                    sx,
                    sy,
                  })
                }
                onLeave={clearHover}
                label={box.name}
                topLabel={
                  item.boxIdx === item.cell.boxes.length - 1 ? box.name : null
                }
                cellLabel={item.boxIdx === 0 ? item.cell.code : null}
              />
            );
          })}
        </svg>

        {/* Enriched tooltip: shows the whole stack */}
        {hover && (
          <div
            className="pointer-events-none absolute z-30 panel !shadow-stamp !p-2.5 max-w-[260px]"
            style={{
              left: Math.min(hover.sx + 14, (containerRef.current?.clientWidth ?? 9999) - 270),
              top: Math.min(hover.sy + 14, (containerRef.current?.clientHeight ?? 9999) - 200),
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="stamp-badge bg-ink text-paper border-ink !text-[9px]">
                {hover.cellCode}
              </span>
              <span className="stamp-badge bg-blueprint text-paper border-ink !text-[9px]">
                {hover.stack.length}/{hover.capacity}
              </span>
            </div>
            <ol className="space-y-1">
              {[...hover.stack].reverse().map((b) => (
                <li
                  key={b.id}
                  className={clsx(
                    "flex items-center gap-1.5 px-1.5 py-1 border",
                    b.stackIndex === hover.hoveredIdx
                      ? "border-safety bg-safety/10"
                      : "border-ink/15"
                  )}
                >
                  <span className="font-mono text-[9px] text-ink/60 w-5 text-center tabular-nums shrink-0">
                    {b.stackIndex + 1}
                  </span>
                  <span
                    className="w-3 h-3 border border-ink shrink-0"
                    style={{ backgroundColor: b.color }}
                  />
                  <span className="font-display font-bold text-[11px] text-ink truncate flex-1 leading-tight">
                    {b.name}
                  </span>
                  {b.stackIndex === hover.stack.length - 1 && (
                    <span className="font-mono text-[8px] uppercase tracking-wider text-ink/50 shrink-0">
                      top
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Help strip */}
        <div className="absolute bottom-3 left-3 right-3 panel !shadow-stamp !p-2 flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-[0.2em] text-ink/60 pointer-events-none flex-wrap">
          <span>✋ glisser · 🖱️ molette zoom · ⌖ double-clic recentre</span>
          {readOnly && (
            <span className="hidden sm:inline">🔒 lecture seule</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────
function FloorBackdrop({
  bounds,
}: {
  bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number };
}) {
  const { minCol, maxCol, minRow, maxRow } = bounds;
  const pad = 0.4;
  const poly = [
    project(minCol - pad, minRow - pad, 0),
    project(maxCol + 1 + pad, minRow - pad, 0),
    project(maxCol + 1 + pad, maxRow + 1 + pad, 0),
    project(minCol - pad, maxRow + 1 + pad, 0),
  ]
    .map((p) => `${p.sx},${p.sy}`)
    .join(" ");
  return (
    <polygon
      points={poly}
      fill="color-mix(in srgb, var(--ink) 5%, transparent)"
      stroke="color-mix(in srgb, var(--ink) 20%, transparent)"
      strokeWidth={0.5}
      strokeDasharray="4 3"
    />
  );
}

function FloorCell({
  cell,
  isSelected,
  isHighlighted,
  onClick,
  clickable,
}: {
  cell: CellView;
  isSelected: boolean;
  isHighlighted?: boolean;
  onClick: () => void;
  clickable: boolean;
}) {
  const poly = tileTopPolygon(cell.col, cell.row, 0);
  const isAisle = cell.type === "aisle";
  const disabled = !cell.enabled && cell.type === "cell";
  const empty = cell.type === "cell" && cell.enabled && cell.boxes.length === 0;

  let fill = "var(--paper)";
  let stroke = "color-mix(in srgb, var(--ink) 40%, transparent)";
  let strokeDash: string | undefined = "3 2";

  if (isAisle) {
    fill = "url(#hatch)";
    stroke = "color-mix(in srgb, var(--ink) 30%, transparent)";
  } else if (disabled) {
    fill = "color-mix(in srgb, var(--ink) 10%, transparent)";
    stroke = "color-mix(in srgb, var(--ink) 25%, transparent)";
  } else if (empty) {
    fill = "color-mix(in srgb, var(--paper) 60%, var(--paper-dark))";
  } else {
    fill = "color-mix(in srgb, var(--paper) 50%, var(--paper-dark))";
    strokeDash = undefined;
  }

  return (
    <g>
      <polygon
        points={poly}
        fill={fill}
        stroke={stroke}
        strokeWidth={isSelected || isHighlighted ? 2 : 1}
        strokeDasharray={strokeDash}
        onClick={() => clickable && !isAisle && onClick()}
        style={{ cursor: clickable && !isAisle ? "pointer" : "default" }}
      />

      {(empty || isAisle || disabled) && (
        <text
          {...centerOfTopFace(cell.col, cell.row, 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize="9"
          fill="color-mix(in srgb, var(--ink) 55%, transparent)"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {isAisle ? "allée" : disabled ? "✕" : cell.code}
        </text>
      )}

      {isSelected && (
        <polygon
          points={poly}
          fill="none"
          stroke="var(--safety)"
          strokeWidth={3}
          style={{ pointerEvents: "none" }}
        />
      )}
      {isHighlighted && (
        <polygon
          points={poly}
          fill="none"
          stroke="var(--safety)"
          strokeWidth={2}
          strokeDasharray="4 2"
          style={{ pointerEvents: "none" }}
        >
          <animate
            attributeName="stroke-opacity"
            values="1;0.3;1"
            dur="1.4s"
            repeatCount="indefinite"
          />
        </polygon>
      )}
    </g>
  );
}

function BoxCube({
  col,
  row,
  zBottom,
  zTop,
  color,
  isTop,
  isSelected,
  isHighlighted,
  isHovered,
  onClick,
  onHover,
  onLeave,
  topLabel,
  cellLabel,
  label,
}: {
  col: number;
  row: number;
  zBottom: number;
  zTop: number;
  color: string;
  isTop: boolean;
  isSelected: boolean;
  isHighlighted?: boolean;
  isHovered?: boolean;
  onClick: (e: React.MouseEvent) => void;
  onHover: (sx: number, sy: number) => void;
  onLeave: () => void;
  topLabel: string | null;
  cellLabel: string | null;
  label: string | null;
}) {
  const topPoly = boxTopPolygon(col, row, zTop);
  const frontPoly = boxFrontPolygon(col, row, zBottom, zTop);
  const rightPoly = boxRightPolygon(col, row, zBottom, zTop);

  const topFill = color;
  const frontFill = shadeHex(color, 0.22);
  const rightFill = shadeHex(color, 0.38);

  const topCenter = centerOfTopFace(col, row, zTop);
  const frontCorners = frontPoly.split(" ").map((s) => s.split(",").map(Number));
  const frontCenter = {
    x: (frontCorners[0][0] + frontCorners[2][0]) / 2,
    y: (frontCorners[0][1] + frontCorners[2][1]) / 2,
  };

  return (
    <g
      data-iso-box
      onClick={onClick}
      onMouseMove={(e) => {
        const rect = (
          e.currentTarget.ownerSVGElement?.parentElement as HTMLElement
        )?.getBoundingClientRect();
        if (!rect) return;
        onHover(e.clientX - rect.left, e.clientY - rect.top);
      }}
      onMouseLeave={onLeave}
      style={{ cursor: "pointer" }}
    >
      <polygon
        points={rightPoly}
        fill={rightFill}
        stroke="var(--ink)"
        strokeWidth={0.8}
      />
      <polygon
        points={frontPoly}
        fill={frontFill}
        stroke="var(--ink)"
        strokeWidth={0.8}
      />
      <polygon
        points={topPoly}
        fill={topFill}
        stroke="var(--ink)"
        strokeWidth={isSelected || isHovered ? 2 : 0.8}
      />

      {cellLabel && (
        <text
          x={frontCenter.x}
          y={frontCenter.y - (label ? 5 : 2)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize="7"
          fill="rgba(255,255,255,0.75)"
          style={{
            pointerEvents: "none",
            userSelect: "none",
            letterSpacing: "0.1em",
          }}
        >
          {cellLabel}
        </text>
      )}

      {label && (
        <text
          x={frontCenter.x}
          y={frontCenter.y + (cellLabel ? 5 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="Fraunces, serif"
          fontSize="8"
          fontWeight="700"
          fill="rgba(255,255,255,0.95)"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {truncate(label, 10)}
        </text>
      )}

      {topLabel && isTop && (
        <text
          x={topCenter.x}
          y={topCenter.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="Fraunces, serif"
          fontSize="9"
          fontWeight="700"
          fill="rgba(255,255,255,0.95)"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {truncate(topLabel, 14)}
        </text>
      )}

      {(isHighlighted || isHovered) && (
        <polygon
          points={topPoly}
          fill="none"
          stroke="var(--safety)"
          strokeWidth={2.5}
          style={{ pointerEvents: "none" }}
        >
          {isHighlighted && (
            <animate
              attributeName="stroke-opacity"
              values="1;0.3;1"
              dur="1.4s"
              repeatCount="indefinite"
            />
          )}
        </polygon>
      )}
    </g>
  );
}

// ─── FlatSlab ────────────────────────────────────────────────────────
// Renders a cadre (kind:"flat") as a thin vertical panel standing on an edge.
function FlatSlab({
  flat,
  cellSet,
}: {
  flat: FlatEdgeItem;
  cellSet: Set<string>;
}) {
  const SLAB_H = 0.65; // height in stack units
  const zOff = flat.stackIndex * 0.08; // slight z-lift for multiple flats on same edge

  const { rowA, colA, rowB, colB, color, name } = flat;

  let pts: [number, number][];

  if (rowB !== null && colB !== null) {
    if (rowA === rowB) {
      // Same row → vertical boundary between two horizontally adjacent cells
      const edgeCol = Math.min(colA, colB) + 1;
      pts = slabPts(edgeCol, rowA, edgeCol, rowA + 1, zOff, SLAB_H + zOff);
    } else {
      // Same col → horizontal boundary between two vertically adjacent cells
      const edgeRow = Math.min(rowA, rowB) + 1;
      pts = slabPts(colA, edgeRow, colA + 1, edgeRow, zOff, SLAB_H + zOff);
    }
  } else {
    // Outer edge: infer which side lacks a neighbor
    const hasE = cellSet.has(`${rowA},${colA + 1}`);
    const hasW = cellSet.has(`${rowA},${colA - 1}`);
    const hasS = cellSet.has(`${rowA + 1},${colA}`);

    if (!hasE || !hasW) {
      const edgeCol = !hasE ? colA + 1 : colA;
      pts = slabPts(edgeCol, rowA, edgeCol, rowA + 1, zOff, SLAB_H + zOff);
    } else {
      const edgeRow = !hasS ? rowA + 1 : rowA;
      pts = slabPts(colA, edgeRow, colA + 1, edgeRow, zOff, SLAB_H + zOff);
    }
  }

  const points = pts.map((p) => p.join(",")).join(" ");
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;

  return (
    <g style={{ pointerEvents: "none" }}>
      <polygon
        points={points}
        fill={color || "#e8602c"}
        stroke="var(--ink)"
        strokeWidth={1.5}
        opacity={0.9}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="Fraunces, serif"
        fontSize="7"
        fontWeight="700"
        fill="rgba(255,255,255,0.95)"
        style={{ userSelect: "none" }}
      >
        {truncate(name, 12)}
      </text>
    </g>
  );
}

/** Build the 4 projected corners of a slab on an edge defined by two grid points. */
function slabPts(
  x1: number, y1: number,
  x2: number, y2: number,
  zBot: number,
  zTop: number
): [number, number][] {
  const p1 = project(x1, y1, zBot);
  const p2 = project(x2, y2, zBot);
  const p3 = project(x2, y2, zTop);
  const p4 = project(x1, y1, zTop);
  return [
    [p1.sx, p1.sy],
    [p2.sx, p2.sy],
    [p3.sx, p3.sy],
    [p4.sx, p4.sy],
  ];
}

// ─── Helpers ────────────────────────────────────────────────────────
function centerOfTopFace(col: number, row: number, z: number) {
  const p = project(col + 0.5, row + 0.5, z);
  return { x: p.sx, y: p.sy };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
