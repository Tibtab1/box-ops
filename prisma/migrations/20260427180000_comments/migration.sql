-- Add Comment model for per-box discussion with @mention support
CREATE TABLE IF NOT EXISTS "Comment" (
  "id"        TEXT        NOT NULL,
  "boxId"     TEXT        NOT NULL,
  "userId"    TEXT        NOT NULL,
  "text"      TEXT        NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Comment_boxId_createdAt_idx" ON "Comment"("boxId", "createdAt");

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_boxId_fkey"
  FOREIGN KEY ("boxId") REFERENCES "Box"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
