// v8 seed: nothing seeded by default. Users now sign up themselves, and the
// app auto-creates a starter plan for each new user on first login (see
// /api/bootstrap).
//
// Kept as a placeholder so `npm run db:seed` doesn't error.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log(
    "ℹ️   v8 seed is intentionally empty — users are created via /register"
  );
  console.log(
    "    and the first login bootstraps their plan automatically."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
