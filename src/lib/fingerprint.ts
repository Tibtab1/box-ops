// Tiny deep-equal helper specialized for our Cell/Box data shapes.
// Returns true when the new data is structurally equal to the current one,
// so we can skip setState and avoid React re-renders / flicker when
// polling returns unchanged data.
//
// We don't rely on full JSON.stringify because object key order can differ
// from Prisma serialization passes. Instead we compute a stable fingerprint.

export function cellsFingerprint(
  cells: Array<{
    id: string;
    code: string;
    type: string;
    capacity: number;
    enabled: boolean;
    row: number;
    col: number;
    boxes: Array<{ id: string; stackIndex: number; name: string; color: string }>;
  }>
): string {
  const parts: string[] = [];
  // Sort by a stable key so ordering changes in Prisma response don't count as diff
  const sorted = [...cells].sort((a, b) => a.id.localeCompare(b.id));
  for (const c of sorted) {
    parts.push(
      [
        c.id,
        c.code,
        c.type,
        c.capacity,
        c.enabled ? "1" : "0",
        c.row,
        c.col,
        c.boxes
          .map(
            (b) => `${b.id}:${b.stackIndex}:${b.name}:${b.color}`
          )
          .join("|"),
      ].join("#")
    );
  }
  return parts.join(";");
}

export function boxesFingerprint(
  boxes: Array<{
    id: string;
    name: string;
    color: string;
    tags: string[];
    location: { code: string } | null;
    updatedAt: string;
  }>
): string {
  const parts: string[] = [];
  const sorted = [...boxes].sort((a, b) => a.id.localeCompare(b.id));
  for (const b of sorted) {
    parts.push(
      [
        b.id,
        b.name,
        b.color,
        b.tags.join(","),
        b.location?.code ?? "",
        b.updatedAt,
      ].join("#")
    );
  }
  return parts.join(";");
}
