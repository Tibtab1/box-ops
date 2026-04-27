"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import FurnitureDetail from "@/components/FurnitureDetail";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import PlaceSwitcher from "@/components/PlaceSwitcher";
import NotificationBell from "@/components/NotificationBell";
import UndoButton from "@/components/UndoButton";
import Toasts, { useToasts } from "@/components/Toasts";
import { cellsFingerprint, boxesFingerprint } from "@/lib/fingerprint";
import ViewToggle, {
  readStoredViewMode,
  type ViewMode,
} from "@/components/ViewToggle";
import type { CellView, FlatEdgeItem } from "@/lib/types";

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
  | { kind: "create-in-furniture"; parentId: string }
  | { kind: "edit"; boxId: string }
  | { kind: "stack"; code: string }
  | { kind: "cell-edit"; code: string }
  | { kind: "furniture-detail"; boxId: string };

export default function HomePage() {
  const [cells, setCells] = useState<CellView[]>([]);
  const [boxes, setBoxes] = useState<BoxWithLoc[]>([]);
  const [flats, setFlats] = useState<FlatEdgeItem[]>([]);
  // When the user clicks "+ Ajouter Cadre", we enter "placing flat" mode:
  // the plan shows clickable hotspots on each edge. When the user clicks an
  // edge, we open BoxForm in flat-creation mode pre-filled with that edge.
  const [placingFlat, setPlacingFlat] = useState<boolean>(false);
  const [pendingFlatEdge, setPendingFlatEdge] = useState<
    { rowA: number; colA: number; rowB: number | null; colB: number | null } | null
  >(null);
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

  // v12 additions
  const [activeRole, setActiveRole] = useState<
    "owner" | "admin" | "editor" | "viewer" | null
  >(null);
  const [undoRefreshKey, setUndoRefreshKey] = useState(0);
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  // Auto-bump the undo-check key whenever data changes, so the button
  // stays in sync with the server without manual bumps everywhere.
  useEffect(() => {
    setUndoRefreshKey((k) => k + 1);
  }, [cells, boxes]);

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

  // Fingerprints of last data we rendered. Used by silent polling to decide
  // whether the incoming data actually changed before touching state.
  const cellsFpRef = useRef<string>("");
  const boxesFpRef = useRef<string>("");

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = !!opts?.silent;
      let locRes: unknown, boxRes: unknown, placesRes: unknown, activeRes: unknown;
      try {
        [locRes, boxRes, placesRes, activeRes] = await Promise.all([
          fetch("/api/locations").then((r) => r.json()),
          fetch("/api/boxes").then((r) => r.json()),
          fetch("/api/places").then((r) => (r.ok ? r.json() : [])),
          fetch("/api/places/active").then((r) => (r.ok ? r.json() : null)),
        ]);
      } catch {
        // network blip in silent mode: just skip; don't trash the UI
        if (silent) return;
        throw new Error("Network error");
      }

      // Defensively check: API routes can return error objects when things
      // go wrong (e.g. no active place, foreign key error). If we don't
      // guard against that, `.map` below throws.
      // v14: /api/locations now returns { cells, flats } object instead of array.
      let safeCells: CellView[] = [];
      let safeFlats: FlatEdgeItem[] = [];
      if (Array.isArray(locRes)) {
        // Backward compat: old API returned just the cells array
        safeCells = locRes as CellView[];
      } else if (locRes && typeof locRes === "object") {
        const obj = locRes as { cells?: unknown; flats?: unknown };
        safeCells = Array.isArray(obj.cells) ? (obj.cells as CellView[]) : [];
        safeFlats = Array.isArray(obj.flats) ? (obj.flats as FlatEdgeItem[]) : [];
      }
      const safeBoxes = Array.isArray(boxRes)
        ? (boxRes as Array<{
            id: string;
            name: string;
            color: string;
            tags: string[];
            location: { code: string; row: number; col: number } | null;
            updatedAt: string;
          }>)
        : [];

      const newCells = safeCells;
      const mappedBoxes = safeBoxes.map((b) => ({
        id: b.id,
        name: b.name,
        color: b.color,
        tags: b.tags,
        location: b.location,
        updatedAt: b.updatedAt,
      }));

      const newCellsFp = cellsFingerprint(newCells);
      const newBoxesFp = boxesFingerprint(mappedBoxes);

      // Only touch state if something actually changed. This prevents flicker
      // when the 5s poll returns identical data (the common case).
      if (newCellsFp !== cellsFpRef.current) {
        cellsFpRef.current = newCellsFp;
        setCells(newCells);
      }
      if (newBoxesFp !== boxesFpRef.current) {
        boxesFpRef.current = newBoxesFp;
        setBoxes(mappedBoxes);
      }
      // Always update flats — small array, cheap, no ordering issues.
      setFlats(safeFlats);

      // Resolve role on active place (always, it's cheap)
      type PlaceLite = {
        id: string;
        role: "owner" | "admin" | "editor" | "viewer";
      };
      const placesList = Array.isArray(placesRes)
        ? (placesRes as PlaceLite[])
        : [];
      const activePlaceId = (activeRes as { placeId?: string } | null)?.placeId;
      if (activePlaceId) {
        const active = placesList.find((p) => p.id === activePlaceId);
        if (active) setActiveRole(active.role);
      } else if (placesList.length > 0) {
        setActiveRole(placesList[0].role);
      }

      if (!silent) setLoading(false);
    },
    []
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Silent polling every 5 s ───────────────────────────────────────
  // Keeps the plan and the box list in sync with other users' changes.
  // We only poll when the tab is visible (avoids burning fetches in
  // background tabs) and we skip when the user has an open create/edit
  // form — otherwise polling could replace their in-progress data.
  const pollPaused =
    rightPanel.kind === "create" ||
    rightPanel.kind === "edit" ||
    rightPanel.kind === "create-in-furniture";
  useEffect(() => {
    if (pollPaused) return;
    let cancelled = false;
    const POLL_MS = 5000;

    function tick() {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      refresh({ silent: true }).catch(() => {
        // silent errors — just skip, next tick will retry
      });
    }
    const interval = setInterval(tick, POLL_MS);

    // Also refresh when the tab becomes visible after being hidden a while
    function onVisibility() {
      if (document.visibilityState === "visible") {
        refresh({ silent: true }).catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, pollPaused]);

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

  // Drag & drop: move the top box of one cell to another cell
  const handleBoxDrop = useCallback(
    async (boxId: string, targetCode: string) => {
      const res = await fetch(`/api/boxes/${boxId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationCode: targetCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast("error", data.error ?? "Déplacement impossible.");
        return;
      }
      pushToast("success", `Déplacée vers ${targetCode}`);
      await refresh();
    },
    [refresh, pushToast]
  );

  // v13: move a furniture item to a new anchor cell (same span)
  const handleFurnitureDrop = useCallback(
    async (furnitureId: string, targetCode: string) => {
      const res = await fetch(`/api/boxes/${furnitureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationCode: targetCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast("error", data.error ?? "Déplacement impossible.");
        return;
      }
      pushToast("success", `Meuble déplacé vers ${targetCode}`);
      await refresh();
    },
    [refresh, pushToast]
  );

  // v14: move an existing flat to a different edge (drag & drop)
  const handleFlatDrop = useCallback(
    async (
      flatId: string,
      edge: { rowA: number; colA: number; rowB: number | null; colB: number | null }
    ) => {
      const res = await fetch(`/api/boxes/${flatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flatEdgeRowA: edge.rowA,
          flatEdgeColA: edge.colA,
          flatEdgeRowB: edge.rowB,
          flatEdgeColB: edge.colB,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast("error", data.error ?? "Déplacement du cadre impossible.");
        return;
      }
      pushToast("success", "Cadre déplacé");
      await refresh();
    },
    [refresh, pushToast]
  );

  // v13: open the inner view of a furniture on click
  const handleFurnitureClick = useCallback((furnitureId: string) => {
    setRightPanel({ kind: "furniture-detail", boxId: furnitureId });
  }, []);

  const handleUndone = useCallback(async () => {
    pushToast("info", "Action annulée");
    await refresh();
  }, [refresh, pushToast]);

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
            <PlaceSwitcher />
            <StatPill label="Cellules" value={stats.occupiedCells} sub={`/${stats.occupiedCells + stats.freeCells}`} tone="safety" />
            <StatPill
              label="Boîtes"
              value={stats.filledSlots}
              sub={`/${stats.totalSlots} max`}
              tone="blueprint"
            />
            <StatPill label="Taux" value={`${stats.pct}%`} tone="ink" />
            <ExportMenu open={menuOpen} setOpen={setMenuOpen} />
            <UndoButton
              refreshKey={undoRefreshKey}
              onUndone={handleUndone}
              disabled={
                isReadOnly3D ||
                activeRole === "viewer" ||
                activeRole === null
              }
            />
            <NotificationBell />
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
            <button
              onClick={() => {
                setEditMode(false);
                setRightPanel({ kind: "none" });
                setPlacingFlat((v) => !v);
                setPendingFlatEdge(null);
              }}
              className={clsx(
                "whitespace-nowrap font-mono text-[11px] uppercase tracking-widest px-3 py-2 border-2 border-ink transition-all",
                placingFlat ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-paper-dark",
                isReadOnly3D && "opacity-40 cursor-not-allowed"
              )}
              title={
                isReadOnly3D
                  ? "Passez en 2D pour ajouter un cadre"
                  : placingFlat
                  ? "Annuler le placement de cadre"
                  : "Cliquez ensuite sur une ligne du plan"
              }
              disabled={isReadOnly3D}
            >
              {placingFlat ? "✕ Annuler cadre" : "🖼 + Cadre"}
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
                    flats={flats}
                    selectedCode={focusedCode}
                    highlightedCodes={highlighted}
                    measureEndpoints={{
                      a: boxes.find((b) => b.id === measure.a)?.location?.code,
                      b: boxes.find((b) => b.id === measure.b)?.location?.code,
                    }}
                    onCellClick={handleCellClick}
                    onFurnitureClick={handleFurnitureClick}
                    placementMode={placementMode}
                    placingFlat={placingFlat}
                    onEdgeClick={(edge) => {
                      setPendingFlatEdge(edge);
                      setPlacingFlat(false);
                      setRightPanel({ kind: "create", presetCode: null });
                    }}
                    onFlatClick={(flatId) => {
                      setRightPanel({ kind: "detail", boxId: flatId });
                    }}
                    editMode={editMode}
                    onRowMutate={editMode ? handleRowMutate : undefined}
                    onBoxDrop={handleBoxDrop}
                    onFurnitureDrop={handleFurnitureDrop}
                    onFlatDrop={handleFlatDrop}
                    dragEnabled={
                      !editMode &&
                      !placementMode &&
                      !placingFlat &&
                      (activeRole === "owner" ||
                        activeRole === "admin" ||
                        activeRole === "editor")
                    }
                  />
                ) : (
                  <MapGrid3D
                    cells={cells}
                    flats={flats}
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
            pendingFlatEdge={pendingFlatEdge}
            clearPendingFlatEdge={() => setPendingFlatEdge(null)}
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

      <Toasts toasts={toasts} onDismiss={dismissToast} />
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
          <a
            href="/stock"
            target="_blank"
            rel="noopener"
            className="block px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-ink hover:bg-paper-dark"
            onMouseDown={(e) => e.preventDefault()}
          >
            📦 Inventaire stock (SKU)
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
  /** When set, the next "create" form should be a flat with this edge. */
  pendingFlatEdge: { rowA: number; colA: number; rowB: number | null; colB: number | null } | null;
  clearPendingFlatEdge: () => void;
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
    pendingFlatEdge,
    clearPendingFlatEdge,
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
          presetKind={pendingFlatEdge ? "flat" : undefined}
          presetFlatEdge={pendingFlatEdge}
          onSaved={(id) => {
            clearPendingFlatEdge();
            onSaved(id);
          }}
          onCancel={() => {
            clearPendingFlatEdge();
            setPanel({ kind: "none" });
          }}
        />
      )}

      {panel.kind === "create-in-furniture" && (
        <BoxForm
          mode={{ kind: "create" }}
          locations={locationsForForm}
          parentFurnitureId={panel.parentId}
          onSaved={async (newBoxId) => {
            await refresh();
            // After creating the child, return to the furniture detail view
            setPanel({ kind: "furniture-detail", boxId: panel.parentId });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            void newBoxId;
          }}
          onCancel={() =>
            setPanel({ kind: "furniture-detail", boxId: panel.parentId })
          }
        />
      )}

      {panel.kind === "furniture-detail" && (
        <FurnitureDetail
          furnitureId={panel.boxId}
          canEdit={!readOnly}
          onClose={() => {
            setPanel({ kind: "none" });
            setFocusedCode(null);
          }}
          onEditFurniture={(id) => setPanel({ kind: "edit", boxId: id })}
          onAddChild={(parentId) =>
            setPanel({ kind: "create-in-furniture", parentId })
          }
          onOpenChild={(childId) =>
            setPanel({ kind: "detail", boxId: childId })
          }
          onMutate={refresh}
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
