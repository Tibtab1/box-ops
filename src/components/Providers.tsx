"use client";

import { SessionProvider } from "next-auth/react";

// Thin wrapper so layout.tsx (a server component) can still provide a session
// context to its children.
export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
