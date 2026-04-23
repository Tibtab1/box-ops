// Plan presets shown when creating a new Place.
// Each preset = a starter grid of cells. User can always customize afterwards.

export type PlanPreset = {
  id: string;
  icon: string;
  name: string;
  description: string;
  rows: number;
  cols: number;
  /** Approximate real-world size, shown in the UI for user reference. */
  approxSize: string;
};

export const PLAN_PRESETS: PlanPreset[] = [
  {
    id: "closet",
    icon: "🚪",
    name: "Placard / petite réserve",
    description: "Petits espaces, recoin à boîtes d'archives",
    rows: 2,
    cols: 4,
    approxSize: "~2 m²",
  },
  {
    id: "cellar",
    icon: "🛋",
    name: "Cave ou petit garage",
    description: "Sous-sol d'appartement, petit garage",
    rows: 3,
    cols: 6,
    approxSize: "~5-10 m²",
  },
  {
    id: "garage",
    icon: "🏠",
    name: "Grand garage / box standard",
    description: "Box de self-storage, garage familial",
    rows: 4,
    cols: 8,
    approxSize: "~10-15 m²",
  },
  {
    id: "warehouse",
    icon: "🏭",
    name: "Entrepôt ou très grande cave",
    description: "Entrepôt, grande remise, hangar",
    rows: 5,
    cols: 12,
    approxSize: "~20-30 m²",
  },
];

/** Special preset id that means "empty plan — user will design it themselves" */
export const EMPTY_PRESET_ID = "empty";

export function findPreset(id: string): PlanPreset | null {
  return PLAN_PRESETS.find((p) => p.id === id) ?? null;
}

/** Max capacity per cell for our stacking model. Used for display only. */
export const DEFAULT_CELL_CAPACITY = 20;
