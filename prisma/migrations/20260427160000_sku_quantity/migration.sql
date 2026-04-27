-- Add SKU reference and quantity fields to Box (pro mode)
ALTER TABLE "Box" ADD COLUMN IF NOT EXISTS "sku" TEXT;
ALTER TABLE "Box" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;
