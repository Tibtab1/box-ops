"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import MapGrid from "@/components/MapGrid";
import MapGrid3D from "@/components/MapGrid3D";
import BoxDetailPanel from "@/components/BoxDetailPanel";
import BoxForm from "@/components/BoxForm";
import SearchBar from "@/components/SearchBar";
import DistanceMeter from "@/components/DistanceMeter";
import InventoryList from "@/components/InventoryList";
import PlanControls from "@/components/PlanControls";
import CellEditor from "@/components/CellEditor";
import StackPicker from "@/components/StackPicker";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import ViewToggle, {
  readStoredViewMode,
  type ViewMode,
} from "@/components/ViewToggle";
import type { CellView } from "@/lib/types";

type BoxWithLoc = {
  id: string;
  name: string;
  color: string;
  tags: string[];
  location: { code: string; row: number; col: number } | null;
  updatedAt: string;
};

type Tab = "map" | "inventory";

type RightPanel =
  | { kind: "none" }
  | { kind: "detail"; boxId: string }
  | { kind: "create"; presetCode: string | null }
  | { kind: "edit"; boxId: string }
  | { kind: "stack"; code: string }
  | { kind: "cell-edit"; code: string };

export default function HomePage() {
  const [cells, setCells] = useState<CellView[]>([]);
  const [boxes, setBoxes] = useState<BoxWithLoc[]>([]);
  const [tab, setTab] = useState<Tab>("map");
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const [editMode, setEditMode] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>({ kind: "none" });
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [focusedCode, setFocusedCode] = useState<string | null>(null);
  const [measure, setMeasure] = useState<{ a: string | null; b: string | null }>({
    a: null,
    b: null,
  });
  const [loading, setLoading] = useState(true);
  const [mutateError, setMutateError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setViewMode(readStoredViewMode());
  }, []);

  // Bootstrap: on first login the user has no locations yet; ask the server
  // to create a starter plan. Idempotent, so safe to call on every mount.
  useEffect(() => {
    fetch("/api/bootstrap", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.created) {
          // Refresh to show the new plan
          refresh();
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shorthand for "we should prevent any mutating action right now"
  const isReadOnly3D = tab === "map" && viewMode === "3d";

  const refresh = useCallback(async () => {
    const [locRes, boxRes] = await Promise.all([
      fetch("/api/locations").then((r) => r.json()),
      fetch("/api/boxes").then((r) => r.json()),
    ]);
    setCells(locRes);
    setBoxes(
      boxRes.map(
        (b: {
          id: string;
          name: string;
          color: string;
          tags: string[];
          location: { code: string; row: number; col: number } | null;
          updatedAt: string;
        }) => ({
          id: b.id,
          name: b.name,
          color: b.color,
          tags: b.tags,
          location: b.location,
          updatedAt: b.updatedAt,
        })
      )
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const currentCell = useMemo(() => {
    if (rightPanel.kind === "stack" || rightPanel.kind === "cell-edit") {
      return cells.find((c) => c.code === rightPanel.code) ?? null;
    }
    return null;
  }, [rightPanel, cells]);

  const stats = useMemo(() => {
    const storageCells = cells.filter(
      (c) => c.type === "cell" && c.enabled
    );
    const totalSlots = storageCells.reduce((a, c) => a + c.capacity, 0);
    const filledSlots = storageCells.reduce((a, c) => a + c.boxes.length, 0);
    const occupiedCells = storageCells.filter((c) => c.boxes.length > 0).length;
    const freeCells = storageCells.length - occupiedCells;
    const totalBoxes = boxes.length;
    const unplaced = boxes.filter((b) => !b.location).length;
    const pct = totalSlots ? Math.round((filledSlots / totalSlots) * 100) : 0;
    const rows = cells.length ? Math.max(...cells.map((c) => c.row)) : 0;
    return {
      occupiedCells,
      freeCells,
      totalBoxes,
      unplaced,
      pct,
      filledSlots,
      totalSlots,
      rows,
    };
  }, [cells, boxes]);

  const placementMode = rightPanel.kind === "create";

  function handleCellClick(cell: CellView) {
    // In 3D: read-only behavior. Only navigate, never create.
    if (isReadOnly3D) {
      if (cell.type !== "cell" || !cell.enabled) return;
      const n = cell.boxes.length;
      if (n === 0) return; // empty cells do nothing in read-only
      if (n === 1) {
        setRightPanel({ kind: "detail", boxId: cell.boxes[0].id });
      } else {
        setRightPanel({ kind: "stack", code: cell.code });
      }
      setFocusedCode(cell.code);
      return;
    }

    if (editMode) {
      setRightPanel({ kind: "cell-edit", code: cell.code });
      setFocusedCode(cell.code);
      return;
    }
    if (placementMode) {
      if (cell.type !== "cell" || !cell.enabled) return;
      if (cell.boxes.length >= cell.capacity) return;
      setRightPanel({ kind: "create", presetCode: cell.code });
      return;
    }
    if (cell.type !== "cell" || !cell.enabled) return;

    const n = cell.boxes.length;
    if (n === 0) {
      setRightPanel({ kind: "create", presetCode: cell.code });
    } else if (n === 1) {
      setRightPanel({ kind: "detail", boxId: cell.boxes[0].id });
      setFocusedCode(cell.code);
    } else {
      setRightPanel({ kind: "stack", code: cell.code });
      setFocusedCode(cell.code);
    }
  }

  const handleRowMutate = useCallback(
    async (
      row: number,
      action: "add_left" | "add_right" | "remove_left" | "remove_right"
    ) => {
      setMutateError(null);
      const apiAction = (
        {
          add_left: "add_cell_left",
          add_right: "add_cell_right",
          remove_left: "remove_cell_left",
          remove_right: "remove_cell_right",
        } as const
      )[action];
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: apiAction, row }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMutateError(data.error ?? "Erreur.");
        return;
      }
      await refresh();
    },
    [refresh]
  );

  function handleSearchSelect(boxId: string, code: string | null) {
    setRightPanel({ kind: "detail", boxId });
    setFocusedCode(code);
    if (code) {
      document
        .getElementById("grid-root")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function handleSaved(boxId: string) {
    await refresh();
    setRightPanel({ kind: "detail", boxId });
  }

  const locationsForForm = useMemo(
    () =>
      cells.map((c) => ({
        code: c.code,
        type: c.type,
        enabled: c.enabled,
        capacity: c.capacity,
        boxesCount: c.boxes.length,
      })),
    [cells]
  );

  return (
    <main className="min-h-screen">
      <header className="border-b-2 border-ink bg-paper/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-ink grid place-items-center shadow-stamp">
              <span className="font-mono text-paper text-lg font-bold">▣</span>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60 leading-none">
                Self-storage · ed. 07
              </div>
              <h1 className="font-display font-black text-ink text-2xl leading-none mt-0.5">
                BOX·OPS
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <StatPill label="Cellules" value={stats.occupiedCells} sub={`/${stats.occupiedCells + stats.freeCells}`} tone="safety" />
            <StatPill
              label="Boîtes"
              value={stats.filledSlots}
              sub={`/${stats.totalSlots} max`}
              tone="blueprint"
            />
            <StatPill label="Taux" value={`${stats.pct}%`} tone="ink" />
            <ExportMenu open={menuOpen} setOpen={setMenuOpen} />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-start">
          <SearchBar
            onSelectResult={handleSearchSelect}
            onResultsChange={setHighlighted}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <TabSwitch current={tab} onChange={setTab} />
            {tab === "map" && (
              <ViewToggle
                mode={viewMode}
                onChange={(m) => {
                  setViewMode(m);
                  if (m === "3d") {
                    // Drop any mutating state cleanly
                    setEditMode(false);
                    setRightPanel((p) =>
                      p.kind === "create" || p.kind === "edit" || p.kind === "cell-edit"
                        ? { kind: "none" }
                        : p
                    );
                    setFocusedCode(null);
                  }
                }}
              />
            )}
            <button
              disabled={isReadOnly3D}
              onClick={() => {
                setEditMode((v) => !v);
                setRightPanel({ kind: "none" });
                setFocusedCode(null);
                setMutateError(null);
              }}
              className={clsx(
                editMode ? "btn-primary" : "btn-ghost",
                "whitespace-nowrap",
                isReadOnly3D && "opacity-40 cursor-not-allowed"
              )}
              title={
                isReadOnly3D
                  ? "Passez en 2D pour éditer le plan"
                  : undefined
              }
            >
              {editMode ? "✓ Terminé" : "✎ Éditer le plan"}
            </button>
            <button
              disabled={isReadOnly3D}
              onClick={() => {
                setEditMode(false);
                setRightPanel({ kind: "create", presetCode: null });
              }}
              className={clsx(
                "btn-safety whitespace-nowrap",
                isReadOnly3D && "opacity-40 cursor-not-allowed"
              )}
              title={
                isReadOnly3D ? "Passez en 2D pour ajouter une boîte" : undefined
              }
            >
              + Ajouter
            </button>
          </div>
        </div>

        <div
          className={clsx(
            "grid gap-5",
            rightPanel.kind === "none" && !editMode
              ? "grid-cols-1"
              : "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]"
          )}
        >
          <div className="min-w-0 space-y-5" id="grid-root">
            {loading ? (
              <div className="panel p-10 font-mono text-xs uppercase tracking-widest text-ink/50 text-center">
                Chargement du plan…
              </div>
            ) : tab === "map" ? (
              <>
                {viewMode === "2d" ? (
                  <MapGrid
                    cells={cells}
                    selectedCode={focusedCode}
                    highlightedCodes={highlighted}
                    measureEndpoints={{
                      a: boxes.find((b) => b.id === measure.a)?.location?.code,
                      b: boxes.find((b) => b.id === measure.b)?.location?.code,
                    }}
                    onCellClick={handleCellClick}
                    placementMode={placementMode}
                    editMode={editMode}
                    onRowMutate={editMode ? handleRowMutate : undefined}
                  />
                ) : (
                  <MapGrid3D
                    cells={cells}
                    selectedCode={focusedCode}
                    highlightedCodes={highlighted}
                    onCellClick={handleCellClick}
                    readOnly
                  />
                )}

                {mutateError && (
                  <div className="panel bg-safety text-paper border-ink p-3 font-mono text-[11px] uppercase tracking-[0.2em] text-center">
                    {mutateError}
                  </div>
                )}
                {editMode && !mutateError && viewMode === "2d" && (
                  <div className="panel bg-blueprint text-paper border-ink p-3 font-mono text-[11px] uppercase tracking-[0.2em] text-center">
                    ✎ Cliquez une cellule pour la modifier · utilisez + et − pour ajuster chaque rangée
                  </div>
                )}
                {placementMode && (
                  <div className="panel bg-blueprint text-paper border-ink p-3 font-mono text-[11px] uppercase tracking-[0.2em] text-center">
                    Cliquez une cellule libre ou avec place disponible pour y placer la nouvelle boîte.
                  </div>
                )}
                {!editMode && viewMode === "2d" && (
                  <DistanceMeter
                    boxes={boxes}
                    endpoints={measure}
                    onEndpointsChange={setMeasure}
                  />
                )}
              </>
            ) : (
              <InventoryList
                boxes={boxes}
                onOpenBox={(id) => {
                  const b = boxes.find((x) => x.id === id);
                  setRightPanel({ kind: "detail", boxId: id });
                  setFocusedCode(b?.location?.code ?? null);
                  setTab("map");
                }}
              />
            )}
          </div>

          <RightPanel
            editMode={editMode}
            panel={rightPanel}
            currentCell={currentCell}
            rowCount={stats.rows}
            locationsForForm={locationsForForm}
            refresh={refresh}
            setPanel={setRightPanel}
            setFocusedCode={setFocusedCode}
            boxes={boxes}
            onSaved={handleSaved}
            readOnly={isReadOnly3D}
          />
        </div>
      </div>

      <footer className="border-t-2 border-dashed border-ink/30 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50 flex items-center justify-between flex-wrap gap-2">
          <span>BOX·OPS · plan approuvé · ne pas plier</span>
          <span>
            {stats.totalBoxes} boîtes · {stats.unplaced} sans position
          </span>
        </div>
      </footer>
    </main>
  );
}

function ExportMenu({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="btn-ghost !px-3 whitespace-nowrap"
      >
        ⇩ Export
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 panel min-w-[200px] z-30">
          <a
            href="/api/export"
            className="block px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-ink hover:bg-paper-dark border-b-2 border-dashed border-ink/15"
            download
            onMouseDown={(e) => e.preventDefault()}
          >
            ⇩ JSON (sauvegarde)
          </a>
          <a
            href="/print"
            target="_blank"
            rel="noopener"
            className="block px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-ink hover:bg-paper-dark"
            onMouseDown={(e) => e.preventDefault()}
          >
            🖨️ Plan PDF (imprimer)
          </a>
        </div>
      )}
    </div>
  );
}

function RightPanel(props: {
  editMode: boolean;
  panel: RightPanel;
  currentCell: CellView | null;
  rowCount: number;
  locationsForForm: {
    code: string;
    type: string;
    enabled: boolean;
    capacity: number;
    boxesCount: number;
  }[];
  refresh: () => Promise<void>;
  setPanel: (p: RightPanel) => void;
  setFocusedCode: (c: string | null) => void;
  boxes: BoxWithLoc[];
  onSaved: (id: string) => void;
  readOnly: boolean;
}) {
  const {
    editMode,
    panel,
    currentCell,
    rowCount,
    locationsForForm,
    refresh,
    setPanel,
    setFocusedCode,
    boxes,
    onSaved,
    readOnly,
  } = props;

  if (!editMode && panel.kind === "none") return null;

  return (
    <div className="lg:sticky lg:top-24 self-start space-y-4">
      {editMode && (
        <PlanControls rowCount={rowCount} onAction={refresh} />
      )}

      {panel.kind === "cell-edit" && currentCell && (
        <CellEditor
          cell={currentCell}
          onUpdated={async () => {
            await refresh();
          }}
          onClose={() => {
            setPanel({ kind: "none" });
            setFocusedCode(null);
          }}
        />
      )}

      {panel.kind === "stack" && currentCell && (
        <StackPicker
          cell={currentCell}
          onPickBox={(id) => {
            setPanel({ kind: "detail", boxId: id });
          }}
          onAddBox={
            readOnly
              ? undefined
              : () => {
                  setPanel({ kind: "create", presetCode: currentCell.code });
                }
          }
          onClose={() => {
            setPanel({ kind: "none" });
            setFocusedCode(null);
          }}
        />
      )}

      {panel.kind === "detail" && (
        <BoxDetailPanel
          boxId={panel.boxId}
          onClose={() => {
            setPanel({ kind: "none" });
            setFocusedCode(null);
          }}
          onEdit={readOnly ? undefined : (id) => setPanel({ kind: "edit", boxId: id })}
          onDeleted={async () => {
            await refresh();
            setPanel({ kind: "none" });
            setFocusedCode(null);
          }}
          canDelete={!readOnly}
          onJumpToBox={(id) => {
            const b = boxes.find((x) => x.id === id);
            setPanel({ kind: "detail", boxId: id });
            setFocusedCode(b?.location?.code ?? null);
          }}
        />
      )}

      {panel.kind === "create" && (
        <BoxForm
          mode={{ kind: "create" }}
          locations={locationsForForm}
          presetLocationCode={panel.presetCode}
          onSaved={onSaved}
          onCancel={() => setPanel({ kind: "none" })}
        />
      )}

      {panel.kind === "edit" && (
        <BoxForm
          mode={{ kind: "edit", boxId: panel.boxId }}
          locations={locationsForForm}
          onSaved={onSaved}
          onCancel={() =>
            setPanel({ kind: "detail", boxId: panel.boxId })
          }
        />
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone: "ink" | "safety" | "blueprint";
}) {
  const toneCls =
    tone === "safety"
      ? "bg-safety text-paper"
      : tone === "blueprint"
      ? "bg-blueprint text-paper"
      : "bg-ink text-paper";
  return (
    <div className="border-2 border-ink shadow-stamp flex items-stretch">
      <span
        className={clsx(
          "font-mono text-[9px] uppercase tracking-[0.2em] px-2 py-1.5 grid place-items-center",
          toneCls
        )}
      >
        {label}
      </span>
      <span className="font-display font-black text-ink bg-paper px-3 py-1 text-lg grid place-items-center min-w-[3rem]">
        {value}
        {sub && (
          <span className="font-mono text-[9px] font-normal text-ink/50 ml-0.5">
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}

function TabSwitch({
  current,
  onChange,
}: {
  current: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <div className="flex border-2 border-ink shadow-stamp bg-paper">
      {(["map", "inventory"] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={clsx(
            "font-mono text-[10px] uppercase tracking-[0.2em] px-3 py-2 transition-colors",
            current === t
              ? "bg-ink text-paper"
              : "bg-paper text-ink hover:bg-paper-dark"
          )}
        >
          {t === "map" ? "Carte" : "Inventaire"}
        </button>
      ))}
    </div>
  );
}
