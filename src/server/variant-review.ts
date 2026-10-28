/** Rejection path for translation review without a recorded approval. */
import { prisma } from "@/lib/db";

export async function decideOrCreateRejection(
  workspaceId: string,
  variantId: string,
  userId: string,
  note: string
): Promise<void> {
  await prisma.localizationVariant.update({
    where: { id: variantId },
    data: { status: "queued", reviewNotes: note },
  });
  await prisma.approvalRequest.updateMany({
    where: { workspaceId, objectId: variantId, status: "pending" },
    data: { status: "rejected", decidedById: userId, decisionNote: note, decidedAt: new Date() },
  });
}
