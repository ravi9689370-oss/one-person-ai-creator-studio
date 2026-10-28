import { describe, expect, it, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { refreshIntegrationStatuses } from "@/server/integrations";

let workspaceId = "";

beforeAll(async () => {
  const ws = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  workspaceId = ws?.id ?? "";
  expect(workspaceId).toBeTruthy();
  await refreshIntegrationStatuses(workspaceId);
});

describe("integration status derivation", () => {
  it("derives statuses from the environment (not self-assertion)", async () => {
    const rows = await prisma.integration.findMany({ where: { workspaceId } });
    expect(rows.length).toBeGreaterThan(5);

    const storage = rows.find((r) => r.providerKey === "local_storage");
    expect(storage?.status).toBe("operational");

    for (const providerKey of ["anthropic", "openai", "stripe", "elevenlabs"]) {
      const row = rows.find((r) => r.providerKey === providerKey);
      if (row) {
        // No real credentials exist in the test environment, so every external
        // provider must report an awaiting state - never a fake 'connected'.
        expect(["awaiting_credentials", "configured", "mock", "manual", "unsupported"]).toContain(row.status);
        expect(row.status).not.toBe("operational");
      }
    }
  });

  it("marks manual-workflow providers as intentional boundaries", async () => {
    const rows = await prisma.integration.findMany({ where: { workspaceId, category: "social" } });
    const substack = rows.find((r) => r.providerKey === "substack");
    if (substack) expect(substack.status).toBe("manual");
  });
});
