-- v12: add UndoEntry table for undo/redo support

CREATE TABLE "UndoEntry" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "placeId"   TEXT NOT NULL,
  "kind"      TEXT NOT NULL,
  "payload"   JSONB NOT NULL,
  "label"     TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UndoEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UndoEntry_placeId_fkey"
    FOREIGN KEY ("placeId") REFERENCES "Place"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "UndoEntry_userId_placeId_createdAt_idx"
  ON "UndoEntry"("userId", "placeId", "createdAt");
