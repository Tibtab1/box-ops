-- Add flat (frame/painting) item support to Box
-- Adds 5 nullable columns. All existing boxes keep working unchanged.

ALTER TABLE "Box" ADD COLUMN "widthCm" INTEGER;
ALTER TABLE "Box" ADD COLUMN "heightCm" INTEGER;
ALTER TABLE "Box" ADD COLUMN "flatType" TEXT;
ALTER TABLE "Box" ADD COLUMN "isFragile" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Box" ADD COLUMN "estimatedValueCents" INTEGER;
