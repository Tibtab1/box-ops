// When a user signs in (or signs up), check if there are email-based
// invitations waiting for their address, and convert them into real
// PlaceShare rows. Silently no-ops if no invites found.
//
// This runs from the Auth.js `signIn` callback (on every sign-in) so:
//   - brand-new users get their invitations as soon as they sign up
//   - existing users get newly-added invitations on their next sign-in
import { prisma } from "@/lib/prisma";

export async function claimPendingInvitations(
  userId: string,
  email: string | null | undefined
): Promise<number> {
  if (!email) return 0;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return 0;

  const pending = await prisma.placeInvitation.findMany({
    where: {
      kind: "email",
      email: normalized,
    },
  });
  if (pending.length === 0) return 0;

  let claimed = 0;
  for (const inv of pending) {
    // If the user already has a share (somehow), don't duplicate
    const existing = await prisma.placeShare.findUnique({
      where: { placeId_userId: { placeId: inv.placeId, userId } },
    });
    if (!existing) {
      await prisma.placeShare.create({
        data: { placeId: inv.placeId, userId, role: inv.role },
      });
      claimed++;
    }
    // Delete the invite either way — it's been handled
    await prisma.placeInvitation.delete({ where: { id: inv.id } });
  }
  return claimed;
}
