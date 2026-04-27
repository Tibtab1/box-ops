-- Add isFavorite and heightFactor to Box
ALTER TABLE "Box" ADD COLUMN IF NOT EXISTS "isFavorite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Box" ADD COLUMN IF NOT EXISTS "heightFactor" INTEGER NOT NULL DEFAULT 1;

-- Create PlanLog table for plan audit trail
CREATE TABLE IF NOT EXISTS "PlanLog" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlanLog_placeId_createdAt_idx" ON "PlanLog"("placeId", "createdAt");

ALTER TABLE "PlanLog" ADD CONSTRAINT "PlanLog_placeId_fkey"
    FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanLog" ADD CONSTRAINT "PlanLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
