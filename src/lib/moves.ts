import { prisma } from "@/lib/prisma";

type LogMoveArgs = {
  boxId: string;
  fromCode: string | null;
  toCode: string | null;
  fromStackIndex: number | null;
  toStackIndex: number | null;
  reason: "create" | "move" | "detach" | "reorder" | "undo";
};

/**
 * Append a row to the Move log. Called from box create / update / reorder flows.
 * We store codes rather than location IDs so the history survives cell deletions.
 */
export async function logMove(args: LogMoveArgs) {
  await prisma.move.create({
    data: {
      boxId: args.boxId,
      fromCode: args.fromCode,
      toCode: args.toCode,
      fromStackIndex: args.fromStackIndex,
      toStackIndex: args.toStackIndex,
      reason: args.reason,
    },
  });
}
