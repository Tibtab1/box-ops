// Deterministic color derivation from a string.
// Same input → same output. Palette stays coherent with the blueprint theme.
//
// Usage: colorFromName("Livres — Romans") → "#1e5aa8"

const PALETTE = [
  "#e8602c", // safety orange
  "#1e5aa8", // blueprint blue
  "#1a2332", // ink
  "#8b6f47", // kraft brown
  "#4a8bd4", // light blueprint
  "#c44a1c", // dark safety
  "#2d3e55", // ink-light
  "#b89968", // light kraft
  "#5f7d4e", // muted green
  "#8e3b6b", // plum
  "#b89f3a", // mustard
  "#3b6b7a", // teal
];

/** FNV-1a 32-bit hash — fast, stable, small. Good enough for coloring. */
function hash(str: string): number {
  // normalize: lowercase + trim so "Livres" and "livres " collide on purpose
  const s = str.trim().toLowerCase();
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function colorFromName(name: string): string {
  if (!name || !name.trim()) return PALETTE[0];
  const h = hash(name);
  return PALETTE[h % PALETTE.length];
}

export const COLOR_PALETTE = PALETTE;
