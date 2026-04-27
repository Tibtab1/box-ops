"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "box-ops-guide-v1";

const STEPS = [
  {
    icon: "📍",
    title: "Le plan",
    desc: "Cliquez sur une cellule du plan pour y créer une boîte ou voir son contenu. Les numéros indiquent le remplissage.",
  },
  {
    icon: "📦",
    title: "Les boîtes",
    desc: "Nommez, colorez, étiquetez et photographiez vos objets. Plusieurs boîtes peuvent s'empiler dans une même cellule.",
  },
  {
    icon: "🪑",
    title: "Les meubles",
    desc: "Ajoutez des étagères ou armoires (de 1×1 à 3×3 cellules) et rangez des boîtes à l'intérieur.",
  },
  {
    icon: "🖼",
    title: "Les cadres",
    desc: "Cliquez sur « + Cadre » puis sur une ligne du plan pour y accrocher tableaux, photos et miroirs.",
  },
  {
    icon: "🔍",
    title: "L'inventaire",
    desc: "Retrouvez n'importe quel objet en filtrant par type, tag, couleur ou emplacement. Onglet « Inventaire » en bas.",
  },
  {
    icon: "↔",
    title: "Drag & drop",
    desc: "Déplacez boîtes, meubles et cadres en les faisant glisser directement sur le plan.",
  },
  {
    icon: "🏢",
    title: "Plusieurs lieux",
    desc: "Créez autant de lieux que vous voulez (cave, garage, box…) et invitez d'autres personnes à les gérer avec vous.",
  },
  {
    icon: "📋",
    title: "Mode édition",
    desc: "Activez « Éditer » pour ajouter / supprimer des rangées et colonnes, renommer les cellules ou changer leur capacité.",
  },
];

export default function WelcomeGuide({
  forceOpen,
  onClose,
}: {
  forceOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  function close() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
    onClose?.();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink/70 overscroll-contain">
      <div className="panel w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-safety font-bold mb-1">
            ★ Guide rapide
          </div>
          <h2 className="font-display text-3xl font-black text-ink leading-tight">
            Comment ça marche ?
          </h2>
          <p className="font-mono text-[11px] text-ink/60 mt-1 leading-relaxed">
            Les 8 gestes essentiels pour maîtriser BOX·OPS.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STEPS.map((s) => (
            <div
              key={s.title}
              className="border-2 border-ink/20 p-3 space-y-1 bg-paper-dark"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{s.icon}</span>
                <span className="font-display font-bold text-sm text-ink">
                  {s.title}
                </span>
              </div>
              <p className="font-mono text-[11px] text-ink/70 leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        <button onClick={close} className="btn-primary w-full">
          Compris, allons-y →
        </button>
        <p className="font-mono text-[10px] text-center text-ink/40">
          Retrouvez ce guide à tout moment via le bouton{" "}
          <strong className="text-ink/60">?</strong> en haut à droite.
        </p>
      </div>
    </div>
  );
}
