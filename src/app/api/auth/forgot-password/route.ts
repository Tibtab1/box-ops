import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// POST /api/auth/forgot-password
// Body: { email: string }
// Always returns 200 to avoid user enumeration
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: true }); // don't leak validation details
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // Only send email if user exists AND has a password (not OAuth-only)
  if (user?.passwordHash) {
    // Invalidate any existing tokens for this user
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    try {
      await sendPasswordResetEmail(email, token);
    } catch (e) {
      console.error("sendPasswordResetEmail failed:", e);
      // Still return 200 — don't expose email sending failures
    }
  }

  return NextResponse.json({ ok: true });
}
