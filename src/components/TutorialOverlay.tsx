"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";

const STORAGE_KEY = "box-ops-tutorial-v1";
const PAD = 10;
const TOOLTIP_W = 340;

type Position = "right" | "left" | "bottom" | "top" | "center";

interface Step {
  target?: string;
  title: string;
  desc: string;
  tip?: string;
  position?: Position;
}

const STEPS: Step[] = [
  {
    title: "Bienvenue dans BOX·OPS",
    desc: "Vous venez de créer votre espace de stockage. BOX·OPS vous permet de cartographier chaque boîte, meuble et cadre en 2D et en 3D — pour ne plus jamais perdre un objet.",
    tip: "Ce guide vous emmène pas à pas sur les fonctionnalités clés. Vous pouvez le relancer à tout moment via le bouton ? en haut à droite.",
    position: "center",
  },
  {
    target: "plan",
    title: "Le plan de stockage",
    desc: "Chaque carré représente une cellule physique de votre espace. Le chiffre affiché (ex : 3/20) indique combien de boîtes s'y trouvent sur la capacité maximum. Les cellules colorées contiennent des objets.",
    tip: "Survolez une cellule pour voir son nom. Zoomez avec la molette de la souris sur le plan.",
    position: "right",
  },
  {
    target: "plan",
    title: "Cliquer sur une cellule",
    desc: "Un clic sur une cellule vide ouvre directement le formulaire de création de boîte. Sur une cellule occupée, un sélecteur apparaît pour choisir quelle boîte consulter ou modifier.",
    tip: "Si une cellule contient un meuble, cliquez sur le meuble directement pour voir son contenu.",
    position: "right",
  },
  {
    target: "ajouter",
    title: "Créer une boîte",
    desc: "Le bouton « + Ajouter » ouvre le formulaire de création. Donnez un nom, choisissez une couleur, ajoutez des tags (ex : « Hiver », « Cuisine ») et une photo. Vous pouvez aussi renseigner un SKU et une quantité pour les professionnels.",
    tip: "Le formulaire permet aussi de créer un meuble : sélectionnez le type « Meuble » et choisissez sa taille (1×1 jusqu'à 3×3 cellules).",
    position: "bottom",
  },
  {
    target: "cadre",
    title: "Accrocher des cadres",
    desc: "Les cadres (tableaux, photos, miroirs) ne vivent pas dans une cellule mais sur les parois entre deux cellules. Cliquez sur « 🖼 + Cadre » pour activer le mode placement, puis cliquez sur un trait du plan pour y poser votre cadre.",
    tip: "Vous pouvez renseigner les dimensions en cm, le type (tableau, photo, miroir…) et une valeur estimée — utile pour les déclarations d'assurance.",
    position: "bottom",
  },
  {
    target: "plan",
    title: "Drag & drop",
    desc: "Toutes les boîtes, meubles et cadres se déplacent par glisser-déposer. Maintenez le clic sur un élément du plan et faites-le glisser vers une autre cellule ou une autre paroi.",
    tip: "Vous avez fait une erreur ? Ctrl+Z annule la dernière action. L'historique est accessible dans le menu Export.",
    position: "right",
  },
  {
    target: "vue3d",
    title: "Vue 3D isométrique",
    desc: "Basculez entre la vue 2D (plan) et la vue 3D isométrique grâce aux boutons 2D / 3D. En 3D, les meubles ont une hauteur réaliste (×1, ×2 ou ×3). Cliquez sur une boîte en 3D pour la surligner dans l'inventaire.",
    tip: "En vue 3D, activez le « Rayon X » (bouton ✦) pour rendre les meubles transparents et voir les boîtes à l'intérieur.",
    position: "bottom",
  },
  {
    target: "inventaire",
    title: "Plan ↔ Inventaire",
    desc: "Basculez entre l'onglet Plan et l'onglet Inventaire. L'inventaire liste tous vos objets avec leurs infos. Cliquer sur un objet dans l'inventaire le surligne en jaune sur le plan et ouvre sa fiche.",
    tip: "Le bouton ⊞ Vue partagée affiche le plan et l'inventaire côte-à-côte sur grand écran.",
    position: "bottom",
  },
  {
    target: "inventaire",
    title: "Filtres de l'inventaire",
    desc: "Dans l'inventaire, filtrez vos objets par type (boîte, meuble, cadre), par couleur, par tag ou par cellule. L'étoile ★ dans une fiche de boîte la marque comme favori — filtrable avec le filtre ★.",
    tip: "Le filtre « Sans emplacement » liste les boîtes qui n'ont pas encore été placées sur le plan.",
    position: "bottom",
  },
  {
    target: "recherche",
    title: "Recherche instantanée",
    desc: "Tapez n'importe quel mot dans la barre de recherche : nom de boîte, tag, couleur, référence SKU. Les résultats sont surlignés en temps réel sur le plan. La recherche parcourt tout votre espace, même les meubles.",
    tip: "La recherche fonctionne aussi depuis l'inventaire — le filtre texte en haut de la liste fait la même chose.",
    position: "bottom",
  },
  {
    target: "edition",
    title: "Mode édition du plan",
    desc: "Le bouton « ✎ Éditer » active le mode édition : ajoutez ou supprimez des rangées et colonnes, renommez les cellules (A1, B2…), changez leur capacité maximale. Parfait pour s'adapter à la disposition réelle de votre espace.",
    tip: "En mode édition, les boutons + et − à droite de chaque rangée ajoutent ou retirent une colonne uniquement sur cette rangée.",
    position: "bottom",
  },
  {
    target: "lieu",
    title: "Plusieurs lieux & partage",
    desc: "Ce sélecteur vous permet de passer d'un lieu à l'autre (cave, garage, box self-stockage…). Créez un nouveau lieu avec le bouton + et invitez des collaborateurs par email avec différents droits : lecteur, éditeur ou administrateur.",
    tip: "Un collaborateur « lecteur » voit le plan mais ne peut rien modifier. Un « éditeur » peut déplacer et créer des boîtes.",
    position: "bottom",
  },
  {
    target: "export",
    title: "Export & historique",
    desc: "Le menu Export propose : téléchargement JSON pour sauvegarder vos données, impression PDF du plan, vue inventaire par SKU (page /stock), et historique des 50 dernières modifications.",
    tip: "L'export JSON est un format lisible — idéal pour faire une sauvegarde avant de grandes réorganisations.",
    position: "left",
  },
  {
    title: "Vous êtes prêt !",
    desc: "Vous connaissez maintenant toutes les fonctionnalités de BOX·OPS. Commencez par placer vos premières boîtes sur le plan, ajoutez des tags dès la création, et profitez de la recherche pour tout retrouver en un instant.",
    tip: "Ce guide est accessible à tout moment via le bouton ? en haut à droite. Bonne organisation !",
    position: "center",
  },
];

export default function TutorialOverlay({
  forceOpen,
  onClose,
}: {
  forceOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [textVisible, setTextVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (forceOpen) {
      setStep(0);
      setOpen(true);
      setTextVisible(true);
    }
  }, [forceOpen]);

  const updateRect = useCallback(() => {
    const target = STEPS[step]?.target;
    if (!target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tutorial="${target}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      // Element hidden (display:none) returns zero rect — treat as not found
      if (r.width === 0 && r.height === 0) {
        setRect(null);
      } else {
        setRect(r);
      }
    } else {
      setRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (!open) return;
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [open, updateRect]);

  function goTo(newStep: number) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTextVisible(false);
    timerRef.current = setTimeout(() => {
      setStep(newStep);
      setTextVisible(true);
    }, 180);
  }

  function close() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
    onClose?.();
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!open) return null;

  const s = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const stepLabel = String(step + 1).padStart(2, "0");
  const totalLabel = String(STEPS.length).padStart(2, "0");

  // Clip-path polygon: creates a "spotlight" hole in the dark overlay
  let clipPath: string | undefined;
  if (rect) {
    const t = Math.max(rect.top - PAD, 0);
    const l = Math.max(rect.left - PAD, 0);
    const r = Math.min(rect.right + PAD, window.innerWidth);
    const b = Math.min(rect.bottom + PAD, window.innerHeight);
    clipPath = `polygon(0px 0px, 0px 100%, ${l}px 100%, ${l}px ${t}px, ${r}px ${t}px, ${r}px ${b}px, ${l}px ${b}px, ${l}px 100%, 100% 100%, 100% 0px)`;
  }

  const tooltipPos = computeTooltipPosition(rect, s.position ?? "center");

  return (
    <>
      {/* Click blocker — above app, below overlay */}
      <div className="fixed inset-0 z-[79]" onClick={(e) => e.stopPropagation()} />

      {/* Dark overlay with spotlight hole */}
      <div
        className="fixed inset-0 z-[80] pointer-events-none"
        style={{
          background: "rgba(8, 8, 12, 0.86)",
          clipPath,
          transition: "clip-path 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />

      {/* Animated highlight ring */}
      {rect && (
        <div
          className="fixed z-[81] pointer-events-none"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            outline: "2px solid rgba(59,130,246,0.9)",
            boxShadow:
              "0 0 0 4px rgba(59,130,246,0.12), 0 0 24px 4px rgba(59,130,246,0.18)",
            transition: "all 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="fixed z-[82] pointer-events-auto"
        style={{
          ...tooltipPos,
          width: TOOLTIP_W,
          opacity: textVisible ? 1 : 0,
          transform: tooltipPos.transform
            ? `${tooltipPos.transform} translateY(${textVisible ? "0px" : "7px"})`
            : `translateY(${textVisible ? "0px" : "7px"})`,
          transition: "opacity 0.18s ease, transform 0.18s ease",
        }}
      >
        <div className="border-2 border-ink bg-paper shadow-[6px_6px_0px_0px_rgba(0,0,0,0.9)] p-5 space-y-4">
          {/* Step counter + skip */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-blueprint font-bold">
              Étape {stepLabel}&thinsp;/&thinsp;{totalLabel}
            </span>
            <button
              onClick={close}
              className="font-mono text-[10px] uppercase tracking-widest text-ink/40 hover:text-ink transition-colors"
            >
              Passer ✕
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-[2px] bg-ink/10 overflow-hidden -mt-1">
            <div
              className="h-full bg-blueprint"
              style={{
                width: `${((step + 1) / STEPS.length) * 100}%`,
                transition: "width 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>

          {/* Title + description */}
          <div className="space-y-2">
            <h3 className="font-display font-black text-[1.3rem] text-ink leading-tight">
              {s.title}
            </h3>
            <p className="font-mono text-[11px] text-ink/70 leading-relaxed">
              {s.desc}
            </p>
          </div>

          {/* Tip block */}
          {s.tip && (
            <div className="border-l-2 border-blueprint pl-3 bg-blueprint/5 py-2 pr-2">
              <p className="font-mono text-[10px] text-ink/60 leading-relaxed">
                <span className="text-blueprint font-bold">Astuce —</span>{" "}
                {s.tip}
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={() => goTo(step - 1)}
                className="font-mono text-[10px] uppercase tracking-widest border-2 border-ink px-3 py-1.5 text-ink hover:bg-paper-dark transition-colors shrink-0"
              >
                ← Préc.
              </button>
            )}
            <button
              onClick={() => (isLast ? close() : goTo(step + 1))}
              className={clsx(
                "flex-1 font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border-2 transition-colors",
                isLast
                  ? "border-blueprint bg-blueprint text-paper hover:bg-blueprint/90"
                  : "border-ink bg-ink text-paper hover:bg-ink/80"
              )}
            >
              {isLast ? "Terminer ✓" : "Suivant →"}
            </button>
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 pt-0.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Étape ${i + 1}`}
                style={{
                  width: i === step ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  background:
                    i === step
                      ? "rgb(59,130,246)"
                      : i < step
                      ? "rgba(59,130,246,0.35)"
                      : "rgba(0,0,0,0.15)",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function computeTooltipPosition(
  rect: DOMRect | null,
  position: Position
): React.CSSProperties {
  if (typeof window === "undefined") {
    return { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
  }

  const W = window.innerWidth;
  const H = window.innerHeight;
  const TOOLTIP_H = 310; // conservative estimated height
  const GAP = PAD + 16;
  const MARGIN = 12;

  if (!rect || position === "center") {
    return { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
  }

  const clampX = (x: number) =>
    Math.max(MARGIN, Math.min(x, W - TOOLTIP_W - MARGIN));
  const clampY = (y: number) =>
    Math.max(MARGIN, Math.min(y, H - TOOLTIP_H - MARGIN));

  const midX = clampX(rect.left + rect.width / 2 - TOOLTIP_W / 2);
  const midY = clampY(rect.top + rect.height / 2 - TOOLTIP_H / 2);

  if (position === "right") {
    const left = rect.right + GAP;
    if (left + TOOLTIP_W < W - MARGIN) return { left, top: midY };
    // Not enough room on right → fall to left
    return { right: W - rect.left + GAP, top: midY };
  }
  if (position === "left") {
    if (rect.left - GAP - TOOLTIP_W > MARGIN)
      return { right: W - rect.left + GAP, top: midY };
    return { left: rect.right + GAP, top: midY };
  }
  if (position === "bottom") {
    const top = rect.bottom + GAP;
    if (top + TOOLTIP_H < H - MARGIN) return { top, left: midX };
    // Not enough room below → go above
    return { bottom: H - rect.top + GAP, left: midX };
  }
  if (position === "top") {
    if (rect.top - GAP - TOOLTIP_H > MARGIN)
      return { bottom: H - rect.top + GAP, left: midX };
    return { top: rect.bottom + GAP, left: midX };
  }

  return { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
}
