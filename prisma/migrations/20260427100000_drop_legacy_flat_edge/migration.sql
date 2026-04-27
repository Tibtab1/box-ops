-- Drop the legacy flatEdge column ("N"|"S"|"E"|"W") that was kept around
-- for safety in the v2 migration. All flats now use flatEdgeRowA/ColA/RowB/ColB.
ALTER TABLE "Box" DROP COLUMN IF EXISTS "flatEdge";
