-- Add edge information for flat (frame/painting) items.
-- A flat is anchored to a cell (locationId, like before) and rests against
-- one of the cell's four edges: north (N), south (S), east (E), or west (W).
-- The column is nullable: only flats use it. Default null for boxes/furniture.

ALTER TABLE "Box" ADD COLUMN "flatEdge" TEXT;

-- Migrate existing flats: place them on their anchor cell's south edge
-- by default. User can change later via the edit form.
UPDATE "Box" SET "flatEdge" = 'S' WHERE "kind" = 'flat' AND "flatEdge" IS NULL;
