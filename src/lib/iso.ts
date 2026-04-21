// Classic 2:1 isometric projection (30° x, 30° y).
// World axes:
//   x → grid column (east)
//   y → grid row    (south, but we invert so back rows render higher on screen)
//   z → stack level (up, bottom = 0)
//
// Screen axes: simple parallelogram with cos/sin of 30°.
//
// We keep the math in one place so the component stays readable.

export const TILE_W = 64;      // world width of one cell
export const TILE_D = 64;      // world depth of one cell
export const TILE_H = 28;      // height of one stacked box in world units

// 2:1 iso: project (x,y,z) to (screenX, screenY)
// We use half-tile width/height on screen for the classic look.
const SCREEN_HALF_W = TILE_W / 2;
const SCREEN_HALF_H = TILE_D / 4; // 2:1 ratio → height is half of width

export function project(
  x: number,
  y: number,
  z: number
): { sx: number; sy: number } {
  const sx = (x - y) * SCREEN_HALF_W;
  const sy = (x + y) * SCREEN_HALF_H - z * TILE_H;
  return { sx, sy };
}

/** Compute the 4 corners of a tile's top face at (col, row, z). */
export function tileTopPolygon(col: number, row: number, z: number): string {
  const p1 = project(col, row, z);
  const p2 = project(col + 1, row, z);
  const p3 = project(col + 1, row + 1, z);
  const p4 = project(col, row + 1, z);
  return `${p1.sx},${p1.sy} ${p2.sx},${p2.sy} ${p3.sx},${p3.sy} ${p4.sx},${p4.sy}`;
}

/** Corners of a box (cube) front face — the one facing the viewer. */
export function boxFrontPolygon(
  col: number,
  row: number,
  zBottom: number,
  zTop: number
): string {
  // Front face = col to col+1, at row+1, between zBottom and zTop
  const bl = project(col, row + 1, zBottom);
  const br = project(col + 1, row + 1, zBottom);
  const tr = project(col + 1, row + 1, zTop);
  const tl = project(col, row + 1, zTop);
  return `${bl.sx},${bl.sy} ${br.sx},${br.sy} ${tr.sx},${tr.sy} ${tl.sx},${tl.sy}`;
}

/** Right side face of a box cube. */
export function boxRightPolygon(
  col: number,
  row: number,
  zBottom: number,
  zTop: number
): string {
  const bl = project(col + 1, row + 1, zBottom);
  const br = project(col + 1, row, zBottom);
  const tr = project(col + 1, row, zTop);
  const tl = project(col + 1, row + 1, zTop);
  return `${bl.sx},${bl.sy} ${br.sx},${br.sy} ${tr.sx},${tr.sy} ${tl.sx},${tl.sy}`;
}

/** Top face of a box cube. */
export function boxTopPolygon(
  col: number,
  row: number,
  zTop: number
): string {
  return tileTopPolygon(col, row, zTop);
}

/**
 * Darken a hex color by a given amount (0..1). Used to shade the side faces
 * so the cube reads as 3D.
 */
export function shadeHex(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const shade = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c * (1 - amount))));
  const hex2 = (c: number) => c.toString(16).padStart(2, "0");
  return `#${hex2(shade(r))}${hex2(shade(g))}${hex2(shade(b))}`;
}

/** Compute render order so boxes drawn later appear in front. */
export function renderDepth(col: number, row: number, z: number): number {
  // Back-to-front painting: higher depth = later = on top.
  // Items further away (lower col+row) render first. Higher z renders later.
  return (col + row) * 1000 + z;
}
