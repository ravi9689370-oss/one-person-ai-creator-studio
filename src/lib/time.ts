/**
 * Timezone math for scheduled reports. DST-safe: we never cache fixed offsets;
 * each evaluation computes the current local wall-clock parts via Intl.
 */
export function computeLocalNowParts(timezone: string, now = new Date()): {
  localTime: string;
  hour: number;
  minute: number;
  dateKey: string; // YYYY-MM-DD in that timezone
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour === "24" ? "0" : parts.hour);
  const minute = Number(parts.minute);
  return {
    localTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    hour,
    minute,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** True when the scheduled local time (hour:minute) has been reached today and not yet run for this date. */
export function isDueNow(params: {
  timezone: string;
  hourLocal: number;
  minuteLocal: number;
  lastRunForDate: string | null;
  now?: Date;
}): boolean {
  const now = params.now ?? new Date();
  const { hour, minute, dateKey } = computeLocalNowParts(params.timezone, now);
  if (params.lastRunForDate === dateKey) return false;
  const target = params.hourLocal * 60 + params.minuteLocal;
  const current = hour * 60 + minute;
  // Due when the window opened today and we are within 24h of it (catch-up).
  return current >= target;
}
