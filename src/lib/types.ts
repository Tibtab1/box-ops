// Shared types — v2 with stacks.

export type LocationDTO = {
  id: string;
  code: string;
  aisle: string;
  slot: number;
  row: number;
  col: number;
  type: "cell" | "aisle" | "wall";
  capacity: number;
  enabled: boolean;
};

export type BoxDTO = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  photoUrl: string | null;
  color: string;
  locationId: string | null;
  stackIndex: number;
  location: LocationDTO | null;
  createdAt: string;
  updatedAt: string;
};

export type CellBoxLite = {
  id: string;
  name: string;
  color: string;
  tags: string[];
  stackIndex: number;
};

export type CellView = LocationDTO & {
  // All boxes stacked here, ordered bottom → top. Empty if none.
  boxes: CellBoxLite[];
};

/** Manhattan distance, still based on grid cells. */
export function gridDistance(
  a: Pick<LocationDTO, "row" | "col">,
  b: Pick<LocationDTO, "row" | "col">
): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function serializeTags(tags: string[]): string {
  return tags
    .map((t) => t.trim())
    .filter(Boolean)
    .join(",");
}

/** Convert a 0-based column index to a letter sequence: 0→A, 25→Z, 26→AA. */
export function colToLetter(col: number): string {
  let s = "";
  let n = col;
  while (true) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return s;
}
