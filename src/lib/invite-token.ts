// URL-safe random token generator. 24 bytes = ~32 chars of base64url,
// collision-safe for our use case (invitation links).
import { randomBytes } from "crypto";

export function generateInviteToken(): string {
  return randomBytes(24)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
