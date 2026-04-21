// Tiny helper: read the current user id from the session, or return a 401.
// All data routes call this first so we never query with a missing userId.
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function requireUserId(): Promise<
  { userId: string } | { error: NextResponse }
> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return {
      error: NextResponse.json(
        { error: "Non authentifié." },
        { status: 401 }
      ),
    };
  }
  return { userId };
}
