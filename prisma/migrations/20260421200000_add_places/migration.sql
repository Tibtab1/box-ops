-- Migration v10: introduce Place and migrate existing data.
-- Strategy:
--   1. Create Place and PlaceShare tables
--   2. Create ONE default Place per existing user (named "Mon premier lieu")
--   3. Backfill placeId on Location and Box rows
--   4. Add NOT NULL constraint + unique index once data is safe
--
-- This runs on Postgres (production). Safe to re-run on a fresh DB
-- (when new deployments run `prisma migrate deploy`, this migration is
-- idempotent because of IF NOT EXISTS guards in step 1).

-- ─── 1. New tables ────────────────────────────────────────────────
CREATE TABLE "Place" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "ownerId"     TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Place_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Place_ownerId_idx" ON "Place"("ownerId");

CREATE TABLE "PlaceShare" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "placeId"   TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "role"      TEXT NOT NULL DEFAULT 'viewer',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceShare_placeId_fkey"
    FOREIGN KEY ("placeId") REFERENCES "Place"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlaceShare_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlaceShare_placeId_userId_key" ON "PlaceShare"("placeId","userId");
CREATE INDEX "PlaceShare_userId_idx" ON "PlaceShare"("userId");

-- ─── 2. One default Place per existing user ──────────────────────
-- Each user who already owns locations OR boxes gets "Mon premier lieu".
-- Use gen_random_uuid() (built into Postgres 13+, available on Neon).
INSERT INTO "Place" ("id", "name", "ownerId", "createdAt")
SELECT
  'pl_' || REPLACE(gen_random_uuid()::text, '-', '')  AS "id",
  'Mon premier lieu'                                   AS "name",
  u."id"                                               AS "ownerId",
  CURRENT_TIMESTAMP                                    AS "createdAt"
FROM "User" u
WHERE EXISTS (SELECT 1 FROM "Location" l WHERE l."userId" = u."id")
   OR EXISTS (SELECT 1 FROM "Box" b WHERE b."userId" = u."id");

-- ─── 3. Add placeId columns (nullable at first so we can backfill) ──
ALTER TABLE "Location" ADD COLUMN "placeId" TEXT;
ALTER TABLE "Box"      ADD COLUMN "placeId" TEXT;

-- Backfill: each row gets its user's default Place
UPDATE "Location" l
SET "placeId" = (SELECT p."id" FROM "Place" p WHERE p."ownerId" = l."userId" LIMIT 1)
WHERE "placeId" IS NULL;

UPDATE "Box" b
SET "placeId" = (SELECT p."id" FROM "Place" p WHERE p."ownerId" = b."userId" LIMIT 1)
WHERE "placeId" IS NULL;

-- ─── 4. Lock down: make NOT NULL, add FK + new unique index ───────
ALTER TABLE "Location" ALTER COLUMN "placeId" SET NOT NULL;
ALTER TABLE "Box"      ALTER COLUMN "placeId" SET NOT NULL;

ALTER TABLE "Location"
  ADD CONSTRAINT "Location_placeId_fkey"
  FOREIGN KEY ("placeId") REFERENCES "Place"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Box"
  ADD CONSTRAINT "Box_placeId_fkey"
  FOREIGN KEY ("placeId") REFERENCES "Place"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop the old userId-based unique constraint, switch to placeId-based
ALTER TABLE "Location" DROP CONSTRAINT IF EXISTS "Location_userId_code_key";
CREATE UNIQUE INDEX "Location_placeId_code_key" ON "Location"("placeId","code");

-- Update indexes: replace userId-based with placeId-based
DROP INDEX IF EXISTS "Location_userId_row_col_idx";
CREATE INDEX "Location_placeId_row_col_idx" ON "Location"("placeId","row","col");

DROP INDEX IF EXISTS "Box_userId_idx";
CREATE INDEX "Box_placeId_idx" ON "Box"("placeId");
