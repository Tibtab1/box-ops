// Edge-safe auth config.
// The middleware runs on Edge, which can't use bcrypt / Prisma. So we split:
//   - auth.config.ts (this file): providers list + callbacks, no DB/bcrypt
//   - auth.ts: full config with Credentials + adapter, used by API routes
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

const hasGoogle =
  !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(hasGoogle
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    // Credentials provider lives in auth.ts — can't run on Edge
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id ?? token.sub;
      }
      if (!token.id && token.sub) token.id = token.sub;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string | undefined;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;
