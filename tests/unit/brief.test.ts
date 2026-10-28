import { describe, expect, it, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { generateMorningBrief } from "@/server/agents/brief";

let workspaceId = "";

beforeAll(async () => {
  const ws = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  workspaceId = ws?.id ?? "";
  expect(workspaceId).toBeTruthy();
});

describe("morning brief generator", () => {
  it("compiles real workspace numbers and labels sparse data honestly", async () => {
    const result = await generateMorningBrief(workspaceId);
    expect(result.reportId).toBeTruthy();
    expect(result.forDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const report = await prisma.report.findUnique({
      where: { id: result.reportId ?? "" },
    });
    expect(report).toBeTruthy();
    const content = JSON.parse(report?.content ?? "{}") as { sections: { heading: string; lines: string[]; dataQuality: string }[] };
    expect(content.sections.length).toBeGreaterThan(2);
    for (const section of content.sections) {
      expect(["real", "partial", "none"]).toContain(section.dataQuality);
      expect(section.heading.length).toBeGreaterThan(0);
    }
  });

  it("is idempotent per local date (retry never duplicates a brief)", async () => {
    const again = await generateMorningBrief(workspaceId);
    const reports = await prisma.report.count({
      where: { workspaceId, kind: "morning_brief", forDate: again.forDate },
    });
    expect(reports).toBe(1);
  });
});
