import { describe, expect, it } from "vitest";
import { computeLocalNowParts, isDueNow } from "@/lib/time";

describe("computeLocalNowParts (DST safety)", () => {
  it("computes the correct local hour across a DST boundary (US spring forward)", () => {
    // 2026-03-08T10:00:00Z - America/New_York has already sprung forward (EDT, UTC-4).
    const edd = computeLocalNowParts("America/New_York", new Date("2026-03-08T10:00:00Z"));
    expect(edd.localTime).toBe("06:00");

    // 2026-03-08T05:00:00Z - before the transition (EST, UTC-5).
    const est = computeLocalNowParts("America/New_York", new Date("2026-03-08T05:00:00Z"));
    expect(est.localTime).toBe("00:00");
    expect(edd.dateKey).toBe("2026-03-08");
    expect(est.dateKey).toBe("2026-03-08");
  });

  it("computes the correct local hour across a DST boundary (UK spring forward)", () => {
    // Europe/London transitions at 2026-03-29T01:00 local (01:00Z): BST (UTC+1) afterwards.
    const bst = computeLocalNowParts("Europe/London", new Date("2026-03-29T09:00:00Z"));
    expect(bst.localTime).toBe("10:00");
    const gmtDay = computeLocalNowParts("Europe/London", new Date("2026-03-28T10:00:00Z"));
    expect(gmtDay.localTime).toBe("10:00");
  });

  it("rolls the local date over near midnight in a positive-offset timezone", () => {
    const before = computeLocalNowParts("Asia/Kolkata", new Date("2026-05-02T18:29:00Z"));
    const after = computeLocalNowParts("Asia/Kolkata", new Date("2026-05-02T18:35:00Z"));
    expect(before.localTime).toBe("23:59");
    expect(after.localTime).toBe("00:05");
    expect(after.dateKey).toBe("2026-05-03");
  });

  it("normalizes the 24-hour edge from ICU numbering", () => {
    const hour24 = computeLocalNowParts("UTC", new Date("2026-01-01T00:00:00Z"));
    expect(hour24.hour).toBe(0);
  });
});

describe("isDueNow", () => {
  const base = { timezone: "America/New_York", hourLocal: 7, minuteLocal: 0 };

  it("becomes due after the local target time and only once per local date", () => {
    const instant = new Date("2026-06-01T12:00:00Z"); // 08:00 EDT
    expect(isDueNow({ ...base, now: instant, lastRunForDate: null })).toBe(true);
    expect(isDueNow({ ...base, now: instant, lastRunForDate: "2026-06-01" })).toBe(false);
  });

  it("is not due before the local target time on the same local day", () => {
    const instant = new Date("2026-06-01T09:00:00Z"); // 05:00 EDT, same local day
    expect(isDueNow({ ...base, now: instant, lastRunForDate: null })).toBe(false);
  });

  it("re-arms on the next local date (catch-up semantics)", () => {
    expect(isDueNow({ ...base, now: new Date("2026-06-02T12:00:00Z"), lastRunForDate: "2026-06-01" })).toBe(true);
  });
});
