-- v11: add PlaceInvitation (email-pending or link-based)

CREATE TABLE "PlaceInvitation" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "placeId"     TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "kind"        TEXT NOT NULL,
  "role"        TEXT NOT NULL DEFAULT 'viewer',
  "email"       TEXT,
  "token"       TEXT,
  "maxUses"     INTEGER,
  "usedCount"   INTEGER NOT NULL DEFAULT 0,
  "expiresAt"   TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceInvitation_placeId_fkey"
    FOREIGN KEY ("placeId") REFERENCES "Place"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlaceInvitation_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PlaceInvitation_token_key" ON "PlaceInvitation"("token");
CREATE INDEX "PlaceInvitation_placeId_idx" ON "PlaceInvitation"("placeId");
CREATE INDEX "PlaceInvitation_email_idx" ON "PlaceInvitation"("email");
