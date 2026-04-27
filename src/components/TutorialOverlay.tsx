"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";

const STORAGE_KEY = "box-ops-tutorial-v1";
const PAD = 10;
const TOOLTIP_W = 310;

type Position = "right" | "left" | "bottom" | "top" | "center";

interface Step {
  target?: string;
  title: string;
  desc: string;
  position?: Position;
}

const STEPS: Step[] = [
  {
    title: "Bienvenue dans BOX·OPS",
    desc: "Gérez votre espace de stockage en 2D et 3D. Ce guide vous montre les 6 points clés pour maîtriser l'application.",
    position: "center",
  },
  {
    target: "plan",
    title: "Le plan de stockage",
    desc: "Chaque carré est une cellule. Le chiffre indique son remplissage (ex: 3/20). Cliquez sur une cellule pour créer ou consulter une boîte.",
    position: "right",
  },
  {
    target: "toolbar",
    title: "Boîtes, meubles & cadres",
    desc: "« + Ajouter » crée une boîte. Le formulaire permet aussi d'ajouter des meubles (étagères 1×1 à 3×3). « 🖼 + Cadre » accroche un tableau ou miroir sur une paroi.",
    position: "bottom",
  },
  {
    target: "inventaire",
    title: "Plan ↔ Inventaire",
    desc: "Basculez entre le plan et la liste complète de vos objets. L'inventaire permet de filtrer par type, couleur, tag ou emplacement.",
    position: "bottom",
  },
  {
    target: "recherche",
    title: "Recherche instantanée",
    desc: "Tapez un nom, un tag ou une couleur pour trouver n'importe quel objet et le surligner immédiatement sur le plan.",
    position: "bottom",
  },
  {
    target: "lieu",
    title: "Plusieurs lieux",
    desc: "Créez autant de lieux que vous voulez — cave, garage, box self-storage — et invitez des collaborateurs à les gérer avec vous.",
    position: "bottom",
  },
  {
    title: "Vous êtes prêt !",
    desc: "Retrouvez ce guide à tout moment en cliquant sur le bouton ? en haut à droite. Bonne organisation !",
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
      setRect(el.getBoundingClientRect());
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

  // Build clip-path to cut a "spotlight" hole in the overlay
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
      {/* Click blocker — sits behind overlay but above the app */}
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
            outlineOffset: "0px",
            boxShadow:
              "0 0 0 4px rgba(59,130,246,0.12), 0 0 20px 2px rgba(59,130,246,0.15)",
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
            ? `${tooltipPos.transform} translateY(${textVisible ? "0px" : "6px"})`
            : `translateY(${textVisible ? "0px" : "6px"})`,
          transition: "opacity 0.18s ease, transform 0.18s ease",
        }}
      >
        <div className="border-2 border-ink shadow-[6px_6px_0px_0px_rgba(0,0,0,0.85)] bg-paper p-5 space-y-3.5">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-blueprint font-bold">
              {stepLabel}&thinsp;/&thinsp;{totalLabel}
            </span>
            <button
              onClick={close}
              className="font-mono text-[10px] uppercase tracking-widest text-ink/40 hover:text-ink transition-colors"
            >
              Passer ✕
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-[2px] bg-ink/10 overflow-hidden">
            <div
              className="h-full bg-blueprint"
              style={{
                width: `${((step + 1) / STEPS.length) * 100}%`,
                transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <h3 className="font-display font-black text-[1.35rem] text-ink leading-tight">
              {s.title}
            </h3>
            <p className="font-mono text-[11px] text-ink/65 leading-relaxed">
              {s.desc}
            </p>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2 pt-0.5">
            {!isFirst && (
              <button
                onClick={() => goTo(step - 1)}
                className="font-mono text-[10px] uppercase tracking-widest border-2 border-ink px-3 py-1.5 text-ink hover:bg-paper-dark transition-colors"
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
          <div className="flex items-center justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Étape ${i + 1}`}
                style={{
                  width: i === step ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === step ? "rgb(59,130,246)" : "rgba(0,0,0,0.18)",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
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
  if (typeof window === "undefined") return { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };

  const W = window.innerWidth;
  const H = window.innerHeight;
  const TOOLTIP_H = 260;
  const GAP = PAD + 14;
  const MARGIN = 12;

  if (!rect || position === "center") {
    return { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
  }

  const clampX = (x: number) => Math.max(MARGIN, Math.min(x, W - TOOLTIP_W - MARGIN));
  const clampY = (y: number) => Math.max(MARGIN, Math.min(y, H - TOOLTIP_H - MARGIN));
  const midY = clampY(rect.top + rect.height / 2 - TOOLTIP_H / 2);
  const midX = clampX(rect.left + rect.width / 2 - TOOLTIP_W / 2);

  if (position === "right") {
    const left = rect.right + GAP;
    if (left + TOOLTIP_W < W - MARGIN) return { left, top: midY };
    return { right: W - rect.left + GAP, top: midY };
  }
  if (position === "left") {
    const right = W - rect.left + GAP;
    if (rect.left - GAP - TOOLTIP_W > MARGIN) return { right, top: midY };
    return { left: rect.right + GAP, top: midY };
  }
  if (position === "bottom") {
    const top = rect.bottom + GAP;
    if (top + TOOLTIP_H < H - MARGIN) return { top, left: midX };
    return { bottom: H - rect.top + GAP, left: midX };
  }
  if (position === "top") {
    const bottom = H - rect.top + GAP;
    if (rect.top - GAP - TOOLTIP_H > MARGIN) return { bottom, left: midX };
    return { top: rect.bottom + GAP, left: midX };
  }

  return { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
}
