/** Morning brief generation + briefing settings (timezone, channels, hour). */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, readBody, audit } from "@/server/api";
import { computeLocalNowParts } from "@/lib/time";

const todaySchema = z.object({});

/** Run the briefing now for "today" in the workspace timezone. */
export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void todaySchema;
  const { generateMorningBrief } = await import("@/server/agents/brief");
  const result = await generateMorningBrief(auth.ctx.workspaceId);
  await audit(auth.ctx, "report.generate_now", "report", result.reportId ?? null, { forDate: result.forDate });
  return ok(result);
}

const settingsSchema = z.object({
  hourLocal: z.number().int().min(0).max(23).default(7),
  minuteLocal: z.number().int().min(0).max(59).default(0),
  timezone: z.string().trim().min(1).max(60),
  channels: z.array(z.enum(["in_app", "email", "slack"])).min(1),
  enabled: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const body = await readBody(req, settingsSchema);
  if ("status" in body) return body as Response;
  if (!isValidTimeZone(body.data.timezone)) return fail(422, "invalid_timezone", "Unknown timezone identifier.");
  const existing = await prisma.scheduledReport.findUnique({
    where: { workspaceId_kind: { workspaceId: auth.ctx.workspaceId, kind: "morning_brief" } },
  });
  const data = {
    hourLocal: body.data.hourLocal,
    minuteLocal: body.data.minuteLocal,
    timezone: body.data.timezone,
    channels: JSON.stringify(body.data.channels),
    enabled: body.data.enabled,
  };
  if (existing) {
    await prisma.scheduledReport.update({ where: { id: existing.id }, data });
  } else {
    await prisma.scheduledReport.create({ data: { workspaceId: auth.ctx.workspaceId, kind: "morning_brief", ...data } });
  }
  await prisma.workspace.update({ where: { id: auth.ctx.workspaceId }, data: { timezone: body.data.timezone } });
  await audit(auth.ctx, "briefing.update", "scheduled_report", existing?.id ?? null, { ...body.data });
  return ok({ ok: true });
}

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void req;
  const schedule = await prisma.scheduledReport.findUnique({
    where: { workspaceId_kind: { workspaceId: auth.ctx.workspaceId, kind: "morning_brief" } },
  });
  const { localTime } = computeLocalNowParts(schedule?.timezone ?? "UTC");
  return ok({ schedule, nowLocal: localTime });
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format();
    return true;
  } catch {
    return false;
  }
}
