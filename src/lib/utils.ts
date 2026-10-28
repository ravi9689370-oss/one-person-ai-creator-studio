import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "workspace";
}

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelative(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 1) return "just now";
  if (Math.abs(mins) < 60) return `${mins > 0 ? "" : "in "}${Math.abs(mins)}m${mins > 0 ? " ago" : ""}`;
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 48) return `${hours > 0 ? "" : "in "}${Math.abs(hours)}h${hours > 0 ? " ago" : ""}`;
  const days = Math.round(hours / 24);
  return `${days > 0 ? "" : "in "}${Math.abs(days)}d${days > 0 ? " ago" : ""}`;
}

export function titleCase(s: string): string {
  return s
    .split(/[ _-]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function truncate(s: string | null | undefined, n = 120): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export const SUPPORTED_LANGUAGES = [
  "en",
  "es",
  "pt",
  "hi",
  "de",
  "fr",
  "ja",
  "vi",
  "ar",
  "id",
  "it",
] as const;

export const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
  hi: "Hindi",
  de: "German",
  fr: "French",
  ja: "Japanese",
  vi: "Vietnamese",
  ar: "Arabic",
  id: "Indonesian",
  it: "Italian",
};

export function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code] ?? titleCase(code);
}
