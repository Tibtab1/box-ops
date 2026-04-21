// Exposes /api/auth/* endpoints (sign-in, callback, session, ...)
// Auth.js v5 gives us pre-built handlers from src/auth.ts.
import { handlers } from "@/auth";

export const { GET, POST } = handlers;

