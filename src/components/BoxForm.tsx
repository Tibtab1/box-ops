"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { colorFromName, COLOR_PALETTE } from "@/lib/color";
import { compressImage, dataUrlByteSize } from "@/lib/image";

type LocationLite = {
  code: string;
  type: string;
  enabled: boolean;
  capacity: number;
  boxesCount: number;
};

type Mode = { kind: "create" } | { kind: "edit"; boxId: string };

type Props = {
  mode: Mode;
  locations: LocationLite[];
  presetLocationCode?: string | null;
  /** When creating a child inside a furniture, provide the parent's ID */
  parentFurnitureId?: string | null;
  /** When creating as a furniture item, skip the toggle and start in furniture mode */
  presetKind?: "box" | "furniture" | "flat";
  /** When creating a flat from clicking on the plan, the parent provides
   *  the edge coordinates the user clicked on. */
  presetFlatEdge?: {
    rowA: number;
    colA: number;
    rowB: number | null;
    colB: number | null;
  } | null;
  onSaved: (boxId: string) => void;
  onCancel: () => void;
};

export default function BoxForm({
  mode,
  locations,
  presetLocationCode,
  parentFurnitureId,
  presetKind,
  presetFlatEdge,
  onSaved,
  onCancel,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  // Color can be automatic (derived from name) or manual (user-picked)
  const [colorMode, setColorMode] = useState<"auto" | "manual">("auto");
  const [manualColor, setManualColor] = useState<string>(COLOR_PALETTE[0]);
  const [locationCode, setLocationCode] = useState<string>(
    presetLocationCode ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(mode.kind === "create");

  // ── v13: furniture support ──
  const [kind, setKind] = useState<"box" | "furniture" | "flat">(
    presetKind ?? "box"
  );
  const [spanW, setSpanW] = useState<number>(1);
  const [spanH, setSpanH] = useState<number>(1);
  // Flat-specific fields
  const [widthCm, setWidthCm] = useState<string>("");
  const [heightCm, setHeightCm] = useState<string>("");
  const [flatType, setFlatType] = useState<"painting" | "photo" | "poster" | "mirror" | "other">("painting");
  const [isFragile, setIsFragile] = useState<boolean>(false);
  const [estimatedValueEuros, setEstimatedValueEuros] = useState<string>("");
  // Edge coordinates for the flat (set from preset when creating, or loaded
  // from the box record when editing).
  const [flatEdgeCoords, setFlatEdgeCoords] = useState<{
    rowA: number;
    colA: number;
    rowB: number | null;
    colB: number | null;
  } | null>(presetFlatEdge ?? null);
  // Track if we're inside a furniture (child creation). Cannot be a furniture then.
  const insideFurniture = !!parentFurnitureId;

  // The actual color used for the preview and submission
  const activeColor = useMemo(
    () => (colorMode === "auto" ? colorFromName(name) : manualColor),
    [colorMode, name, manualColor]
  );

  useEffect(() => {
    if (mode.kind !== "edit") return;
    fetch(`/api/boxes/${mode.boxId}`)
      .then((r) => r.json())
      .then((data) => {
        const b = data.box;
        setName(b.name);
        setDescription(b.description ?? "");
        setTagsInput(b.tags.join(", "));
        setPhotoUrl(b.photoUrl);
        // Edit mode: detect whether the saved color matches what auto would produce.
        // If yes → auto. If no → the user had picked something, start in manual.
        const autoColor = colorFromName(b.name);
        if (b.color?.toLowerCase() === autoColor.toLowerCase()) {
          setColorMode("auto");
          setManualColor(b.color);
        } else {
          setColorMode("manual");
          setManualColor(b.color);
        }
        setLocationCode(b.location?.code ?? "");
        // v13: load kind/span
        setKind(b.kind ?? "box");
        setSpanW(b.spanW ?? 1);
        setSpanH(b.spanH ?? 1);
        // v13.6: load flat-specific fields if present
        if (b.kind === "flat") {
          setWidthCm(b.widthCm != null ? String(b.widthCm) : "");
          setHeightCm(b.heightCm != null ? String(b.heightCm) : "");
          setFlatType(b.flatType ?? "painting");
          setIsFragile(!!b.isFragile);
          if (typeof b.flatEdgeRowA === "number" && typeof b.flatEdgeColA === "number") {
            setFlatEdgeCoords({
              rowA: b.flatEdgeRowA,
              colA: b.flatEdgeColA,
              rowB: typeof b.flatEdgeRowB === "number" ? b.flatEdgeRowB : null,
              colB: typeof b.flatEdgeColB === "number" ? b.flatEdgeColB : null,
            });
          }
          setEstimatedValueEuros(
            b.estimatedValueCents != null
              ? String((b.estimatedValueCents / 100).toFixed(2))
              : ""
          );
        }
        setHydrated(true);
      });
  }, [mode]);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // Reject obviously huge files upfront (before even loading them)
    if (file.size > 12 * 1024 * 1024) {
      setError("Image trop volumineuse (max 12 Mo avant compression).");
      return;
    }

    try {
      const compressed = await compressImage(file);
      const bytes = dataUrlByteSize(compressed);
      // After compression the encoded base64 must stay under ~3 MB so the
      // whole POST body (with other fields) fits under Vercel's 4.5 MB limit.
      if (bytes > 3 * 1024 * 1024) {
        setError(
          `Image encore trop lourde après compression (${Math.round(
            bytes / 1024 / 1024
          )} Mo). Essayez une photo plus petite.`
        );
        return;
      }
      setPhotoUrl(compressed);
    } catch {
      setError("Impossible de lire cette image.");
    }
  }

  function pickColor(c: string) {
    setManualColor(c);
    setColorMode("manual");
  }

  function resetToAuto() {
    setColorMode("auto");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      tags,
      photoUrl,
      color: activeColor,
    };

    // Branch on scenario: child inside furniture / furniture on plan / flat / normal box
    if (mode.kind === "create" && insideFurniture) {
      payload.parentId = parentFurnitureId;
      // children inherit kind from current selection (box or flat)
      if (kind === "flat") {
        payload.kind = "flat";
      }
    } else if (kind === "furniture") {
      payload.kind = "furniture";
      payload.spanW = spanW;
      payload.spanH = spanH;
      payload.locationCode = locationCode || null;
    } else if (kind === "flat") {
      payload.kind = "flat";
      // No locationCode: a flat lives on an edge, not in a cell.
    } else {
      payload.kind = "box";
      payload.locationCode = locationCode || null;
    }

    // For edit mode on furniture, allow resizing
    if (mode.kind === "edit" && kind === "furniture") {
      payload.spanW = spanW;
      payload.spanH = spanH;
    }

    // For flat (create or edit), include the flat-specific fields
    if (kind === "flat") {
      const w = widthCm.trim() ? parseInt(widthCm, 10) : null;
      const h = heightCm.trim() ? parseInt(heightCm, 10) : null;
      payload.widthCm = w && !isNaN(w) && w > 0 ? w : null;
      payload.heightCm = h && !isNaN(h) && h > 0 ? h : null;
      payload.flatType = flatType;
      payload.isFragile = isFragile;
      const valStr = estimatedValueEuros.trim().replace(",", ".");
      const val = valStr ? parseFloat(valStr) : null;
      payload.estimatedValueCents =
        val !== null && !isNaN(val) && val >= 0 ? Math.round(val * 100) : null;
      if (flatEdgeCoords) {
        payload.flatEdgeRowA = flatEdgeCoords.rowA;
        payload.flatEdgeColA = flatEdgeCoords.colA;
        payload.flatEdgeRowB = flatEdgeCoords.rowB;
        payload.flatEdgeColB = flatEdgeCoords.colB;
      }
    }

    try {
      const url =
        mode.kind === "create" ? "/api/boxes" : `/api/boxes/${mode.boxId}`;
      const method = mode.kind === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'enregistrement.");
        setSaving(false);
        return;
      }
      onSaved(data.id);
    } catch {
      setError("Erreur réseau. Réessayez.");
      setSaving(false);
    }
  }

  const availableLocations = locations.filter((l) => {
    if (l.type !== "cell" || !l.enabled) return false;
    if (l.code === locationCode) return true;
    return l.boxesCount < l.capacity;
  });

  if (!hydrated) {
    return (
      <div className="panel p-6 reveal font-mono text-xs uppercase tracking-widest text-ink/60">
        Chargement…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="panel p-5 sm:p-6 space-y-4 reveal">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60">
            Formulaire
          </div>
          <h2 className="font-display text-2xl font-black text-ink leading-tight">
            {mode.kind === "create"
              ? insideFurniture
                ? kind === "flat"
                  ? "Nouveau cadre (dans le meuble)"
                  : "Nouvelle boîte (dans le meuble)"
                : kind === "furniture"
                ? "Nouveau meuble"
                : kind === "flat"
                ? "Nouveau cadre"
                : "Nouvelle boîte"
              : kind === "furniture"
              ? "Éditer le meuble"
              : kind === "flat"
              ? "Éditer le cadre"
              : "Éditer la boîte"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost !px-2.5 !py-1.5"
          aria-label="Annuler"
        >
          ✕
        </button>
      </div>

      {/* Kind toggle (creation mode only) */}
      {mode.kind === "create" && !presetKind && (
        <div className={clsx(
          "grid gap-1.5 p-1 bg-paper-dark/30 border-2 border-ink",
          insideFurniture ? "grid-cols-2" : "grid-cols-3"
        )}>
          <button
            type="button"
            onClick={() => setKind("box")}
            className={clsx(
              "font-mono text-[10px] uppercase tracking-widest py-2 transition-all",
              kind === "box"
                ? "bg-ink text-paper"
                : "text-ink/60 hover:text-ink"
            )}
          >
            📦 Boîte
          </button>
          {!insideFurniture && (
            <button
              type="button"
              onClick={() => setKind("furniture")}
              className={clsx(
                "font-mono text-[10px] uppercase tracking-widest py-2 transition-all",
                kind === "furniture"
                  ? "bg-ink text-paper"
                  : "text-ink/60 hover:text-ink"
              )}
            >
              🪑 Meuble
            </button>
          )}
          <button
            type="button"
            onClick={() => setKind("flat")}
            className={clsx(
              "font-mono text-[10px] uppercase tracking-widest py-2 transition-all",
              kind === "flat"
                ? "bg-ink text-paper"
                : "text-ink/60 hover:text-ink"
            )}
          >
            🖼 Cadre
          </button>
        </div>
      )}

      {/* Furniture dimensions picker */}
      {kind === "furniture" && !insideFurniture && (
        <Field label="Dimensions (cellules)">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((w) => (
              <button
                key={`w${w}`}
                type="button"
                onClick={() => setSpanW(w)}
                className={clsx(
                  "font-mono text-xs uppercase tracking-widest py-2 border-2 transition-all",
                  spanW === w
                    ? "bg-ink text-paper border-ink"
                    : "border-ink/30 text-ink/70 hover:border-ink"
                )}
              >
                Largeur {w}
              </button>
            ))}
            {[1, 2, 3].map((h) => (
              <button
                key={`h${h}`}
                type="button"
                onClick={() => setSpanH(h)}
                className={clsx(
                  "font-mono text-xs uppercase tracking-widest py-2 border-2 transition-all",
                  spanH === h
                    ? "bg-ink text-paper border-ink"
                    : "border-ink/30 text-ink/70 hover:border-ink"
                )}
              >
                Hauteur {h}
              </button>
            ))}
          </div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-ink/50 mt-1.5">
            Ce meuble occupera une zone de {spanW}×{spanH} cellules sur le plan.
          </p>
        </Field>
      )}

      {/* Flat (frame/painting/etc.) specific fields */}
      {kind === "flat" && (
        <div className="space-y-3 p-3 border-2 border-ink/30 bg-paper-dark/20">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink font-bold">
            🖼 Détails du cadre
          </div>

          <Field label="Type">
            <div className="grid grid-cols-5 gap-1">
              {(["painting", "photo", "poster", "mirror", "other"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFlatType(t)}
                  className={clsx(
                    "font-mono text-[9px] uppercase tracking-widest py-2 border-2 transition-all flex flex-col items-center gap-0.5",
                    flatType === t
                      ? "bg-ink text-paper border-ink"
                      : "border-ink/30 text-ink/70 hover:border-ink"
                  )}
                  title={t === "painting" ? "Tableau" : t === "photo" ? "Photo" : t === "poster" ? "Poster" : t === "mirror" ? "Miroir" : "Autre"}
                >
                  <span className="text-base leading-none">
                    {t === "painting" ? "🎨" : t === "photo" ? "📷" : t === "poster" ? "📜" : t === "mirror" ? "🪞" : "🖼"}
                  </span>
                  <span className="text-[8px]">
                    {t === "painting" ? "Tableau" : t === "photo" ? "Photo" : t === "poster" ? "Poster" : t === "mirror" ? "Miroir" : "Autre"}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Largeur (cm)">
              <input
                type="number"
                min={1}
                max={9999}
                step={1}
                className="input-field"
                value={widthCm}
                onChange={(e) => setWidthCm(e.target.value)}
                placeholder="60"
              />
            </Field>
            <Field label="Hauteur (cm)">
              <input
                type="number"
                min={1}
                max={9999}
                step={1}
                className="input-field"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="80"
              />
            </Field>
          </div>

          <Field label="Position du cadre (arête)">
            {flatEdgeCoords ? (
              <div className="border-2 border-ink/40 bg-paper-dark/30 px-3 py-2.5 font-mono text-xs">
                <div className="text-ink font-bold uppercase tracking-widest">
                  Entre R{flatEdgeCoords.rowA + 1}-{flatEdgeCoords.colA + 1}
                  {flatEdgeCoords.rowB !== null && flatEdgeCoords.colB !== null
                    ? ` et R${flatEdgeCoords.rowB + 1}-${flatEdgeCoords.colB + 1}`
                    : " et l'extérieur"}
                </div>
                <div className="text-ink/50 text-[9px] uppercase tracking-widest mt-1">
                  Pour changer la position, annule et clique sur une autre ligne du plan.
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-ink/30 bg-paper-dark/20 px-3 py-2.5 font-mono text-xs text-ink/60">
                Aucune arête sélectionnée. Annule et clique sur une ligne du plan pour positionner ce cadre.
              </div>
            )}
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isFragile}
              onChange={(e) => setIsFragile(e.target.checked)}
              className="w-4 h-4 accent-safety"
            />
            <span className="font-mono text-xs uppercase tracking-widest text-ink">
              ⚠ Fragile (manipuler avec soin)
            </span>
          </label>

          <Field label="Valeur estimée (€, optionnel)">
            <input
              type="text"
              inputMode="decimal"
              className="input-field"
              value={estimatedValueEuros}
              onChange={(e) => setEstimatedValueEuros(e.target.value)}
              placeholder="125.00"
            />
            <p className="font-mono text-[9px] text-ink/50 mt-1">
              Pour assurance ou inventaire. Reste privé.
            </p>
          </Field>
        </div>
      )}

      <Field label="Nom" required>
        <div className="relative">
          <input
            className="input-field pr-12"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Livres — Romans"
            required
            maxLength={120}
          />
          {/* Live color preview attached to the input */}
          <span
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 border-2 border-ink shadow-stamp transition-colors"
            style={{ backgroundColor: activeColor }}
            aria-hidden
            title={
              colorMode === "auto"
                ? "Couleur dérivée automatiquement du nom"
                : "Couleur choisie manuellement"
            }
          />
        </div>
      </Field>

      <Field label="Description">
        <textarea
          className="input-field min-h-[90px] resize-y"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Contenu détaillé, notes spéciales, fragilité…"
        />
      </Field>

      <Field label="Tags (séparés par virgule)">
        <input
          className="input-field"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="livres, fragile, archive"
        />
      </Field>

      <Field label="Photo (optionnelle)">
        <div className="space-y-2">
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="block w-full text-xs font-mono text-ink/70 file:mr-3 file:py-1.5 file:px-3 file:border-2 file:border-ink file:bg-paper file:text-ink file:font-mono file:text-[10px] file:uppercase file:tracking-widest file:cursor-pointer file:shadow-stamp hover:file:bg-paper-dark"
          />
          {photoUrl && (
            <div className="flex items-start gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt="Aperçu"
                className="w-20 h-20 object-cover border-2 border-ink shadow-stamp"
              />
              <button
                type="button"
                onClick={() => setPhotoUrl(null)}
                className="btn-ghost !text-[10px]"
              >
                Retirer
              </button>
            </div>
          )}
        </div>
      </Field>

      {/* Color selector — auto badge + manual override */}
      <Field label="Couleur">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={clsx(
                "stamp-badge",
                colorMode === "auto"
                  ? "bg-ink text-paper border-ink"
                  : "bg-paper text-ink/70 border-ink/40"
              )}
            >
              {colorMode === "auto" ? "⚡ Auto" : "✎ Manuel"}
            </span>
            {colorMode === "manual" && (
              <button
                type="button"
                onClick={resetToAuto}
                className="btn-ghost !text-[10px]"
              >
                ↺ Retour auto
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map((c) => {
              const isActive = c.toLowerCase() === activeColor.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => pickColor(c)}
                  className={clsx(
                    "w-9 h-9 border-2 border-ink transition-all",
                    isActive
                      ? "shadow-stamp-lg -translate-y-0.5"
                      : "shadow-stamp hover:-translate-y-0.5 hover:shadow-stamp-lg"
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Couleur ${c}`}
                />
              );
            })}
          </div>
          <p className="font-mono text-[10px] text-ink/50">
            {colorMode === "auto"
              ? "Dérivée automatiquement du nom. Cliquez une couleur pour forcer."
              : "Choix manuel actif."}
          </p>
        </div>
      </Field>

      {!insideFurniture && kind !== "flat" && (
        <Field
          label={
            kind === "furniture"
              ? `Cellule d'ancrage (${spanW}×${spanH})`
              : "Emplacement"
          }
          required={kind === "furniture"}
        >
          <select
            className="input-field"
            value={locationCode}
            onChange={(e) => setLocationCode(e.target.value)}
            required={kind === "furniture"}
          >
            <option value="">
              — {kind === "furniture" ? "Choisir une cellule" : "Non assigné"} —
            </option>
            {availableLocations.map((l) => {
              const isCurrent = l.code === locationCode;
              return (
                <option key={l.code} value={l.code}>
                  {l.code} · {l.boxesCount}/{l.capacity}
                  {isCurrent && mode.kind === "edit" ? " (actuel)" : ""}
                </option>
              );
            })}
          </select>
          <p className="font-mono text-[10px] text-ink/50 mt-1">
            {kind === "furniture"
              ? `Le meuble couvrira cette cellule et ${spanW * spanH - 1} cellule(s) voisine(s) vers le bas-droite.`
              : "La boîte sera placée au-dessus de la pile."}
          </p>
        </Field>
      )}

      {insideFurniture && (
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 bg-paper-dark/30 border-2 border-dashed border-ink/30 px-3 py-2">
          📥 {kind === "flat" ? "Ce cadre" : "Cette boîte"} sera rangé{kind === "flat" ? "" : "e"} dans le meuble parent.
        </div>
      )}

      {error && (
        <div className="font-mono text-xs uppercase tracking-widest text-safety bg-safety/10 border-2 border-safety px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={saving} className="btn-primary flex-1">
          {saving
            ? "Enregistrement…"
            : mode.kind === "create"
            ? "Créer"
            : "Mettre à jour"}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost">
          Annuler
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70 block mb-1.5">
        {label}
        {required && <span className="text-safety ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}
