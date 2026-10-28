/**
 * Cached workspace→brand lookup (per-request lifetime) for hot paths.
 */
import { prisma } from "@/lib/db";

const cache = new Map<string, Awaited<ReturnType<typeof prisma.brandProfile.findUniqueOrThrow>>>();

export async function brandForWorkspace(workspaceId: string) {
  const hit = cache.get(workspaceId);
  if (hit) return hit;
  const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { workspaceId } });
  cache.set(workspaceId, brand);
  return brand;
}

export function clearBrandCached(workspaceId: string) {
  cache.delete(workspaceId);
}
