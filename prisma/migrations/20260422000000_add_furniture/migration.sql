-- v13: add furniture support to Box

ALTER TABLE "Box" ADD COLUMN "kind"     TEXT NOT NULL DEFAULT 'box';
ALTER TABLE "Box" ADD COLUMN "spanW"    INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Box" ADD COLUMN "spanH"    INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Box" ADD COLUMN "parentId" TEXT;

ALTER TABLE "Box" ADD CONSTRAINT "Box_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Box"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Box_parentId_stackIndex_idx" ON "Box"("parentId", "stackIndex");
