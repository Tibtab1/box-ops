-- v2 of flat positioning: a flat is now an EDGE between two cells
-- (or between a cell and the outside of the plan). It no longer occupies
-- a cell stack — it lives on the boundary line.
--
-- New columns:
--   flatEdgeRowA, flatEdgeColA  : coordinates of the first cell
--   flatEdgeRowB, flatEdgeColB  : coordinates of the second cell (NULL if outer edge)
--
-- The old `flatEdge` column ("N"|"S"|"E"|"W") is migrated to the new model:
-- for each existing flat, we resolve its anchor cell (via locationId), then
-- compute the neighbor cell based on flatEdge direction. If the neighbor
-- doesn't exist in this place, B is left null (outer edge).

ALTER TABLE "Box" ADD COLUMN "flatEdgeRowA" INTEGER;
ALTER TABLE "Box" ADD COLUMN "flatEdgeColA" INTEGER;
ALTER TABLE "Box" ADD COLUMN "flatEdgeRowB" INTEGER;
ALTER TABLE "Box" ADD COLUMN "flatEdgeColB" INTEGER;

-- Step 1: For each flat, populate (rowA, colA) from its anchor cell
UPDATE "Box" b
SET
  "flatEdgeRowA" = l."row",
  "flatEdgeColA" = l."col"
FROM "Location" l
WHERE b."kind" = 'flat'
  AND b."locationId" IS NOT NULL
  AND l."id" = b."locationId";

-- Step 2: Compute (rowB, colB) based on flatEdge direction.
-- N = north (row - 1), S = south (row + 1), E = east (col + 1), W = west (col - 1)
UPDATE "Box" SET "flatEdgeRowB" = "flatEdgeRowA" - 1, "flatEdgeColB" = "flatEdgeColA"
  WHERE "kind" = 'flat' AND "flatEdge" = 'N';
UPDATE "Box" SET "flatEdgeRowB" = "flatEdgeRowA" + 1, "flatEdgeColB" = "flatEdgeColA"
  WHERE "kind" = 'flat' AND "flatEdge" = 'S';
UPDATE "Box" SET "flatEdgeRowB" = "flatEdgeRowA",     "flatEdgeColB" = "flatEdgeColA" + 1
  WHERE "kind" = 'flat' AND "flatEdge" = 'E';
UPDATE "Box" SET "flatEdgeRowB" = "flatEdgeRowA",     "flatEdgeColB" = "flatEdgeColA" - 1
  WHERE "kind" = 'flat' AND "flatEdge" = 'W';

-- Step 3: For flats whose neighbor B is outside the plan (no cell there),
-- we set rowB/colB to NULL — they're "outer edges".
-- A neighbor exists if there's a Location at that position in the same place.
UPDATE "Box" b
SET "flatEdgeRowB" = NULL, "flatEdgeColB" = NULL
WHERE b."kind" = 'flat'
  AND b."flatEdgeRowB" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Location" l2
    WHERE l2."placeId" = b."placeId"
      AND l2."row" = b."flatEdgeRowB"
      AND l2."col" = b."flatEdgeColB"
      AND l2."type" = 'cell'
  );

-- Step 4: clear locationId on flats — they no longer belong to a cell
UPDATE "Box" SET "locationId" = NULL, "stackIndex" = 0 WHERE "kind" = 'flat';

-- Note: we DON'T drop the old `flatEdge` column for safety. It's now unused
-- but kept in case rollback is needed. Can be dropped later in a future migration.
