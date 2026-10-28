/**
 * Image-generation adapter (OpenAI images + labeled dev fixture).
 * Fixture produces a deterministic SVG (real image file, clearly labeled).
 */
import crypto from "node:crypto";
import { providerEnv } from "@/lib/env";
import { ProviderError } from "./llm";

export type ImageResult = {
  mode: "real" | "mock";
  provider: string;
  image: Buffer;
  mime: string;
  mockNote?: string;
};

export function imageConfigured(): { provider: string; configured: boolean } {
  const env = providerEnv();
  if (env.openaiImageApiKey) return { provider: "openai", configured: true };
  return { provider: "mock", configured: false };
}

const TIMEOUT_MS = 120_000;

export async function generateImage(opts: {
  prompt: string;
  mock?: boolean;
  mockFail?: boolean;
}): Promise<ImageResult> {
  const env = providerEnv();
  if (!opts.mock && env.openaiImageApiKey) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { authorization: `Bearer ${env.openaiImageApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "dall-e-3", prompt: opts.prompt.slice(0, 1000), n: 1, size: "1024x576", response_format: "b64_json" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ProviderError("openai-images", `HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new ProviderError("openai-images", "Provider returned no image.");
    return { mode: "real", provider: "openai-images", image: Buffer.from(b64, "base64"), mime: "image/png" };
  }
  if (opts.mockFail) throw new ProviderError("mock-image", "Fixture simulated failure (test hook).");
  const seed = crypto.createHash("sha256").update(opts.prompt).digest("hex").slice(0, 6);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="576">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#4f46e5"/>
  </linearGradient></defs>
  <rect width="1024" height="576" fill="url(#g)"/>
  <circle cx="${200 + parseInt(seed, 16) % 400}" cy="280" r="140" fill="#a5b4fc" opacity="0.35"/>
  <text x="52" y="300" font-family="sans-serif" font-size="44" font-weight="bold" fill="#ffffff" max-width="900">${esc(opts.prompt.slice(0, 120))}</text>
  <text x="52" y="540" font-family="sans-serif" font-size="20" fill="#c7d2fe">DEVELOPMENT FIXTURE IMAGE - configure IMAGE PROVIDER for real output</text>
</svg>`;
  return {
    mode: "mock",
    provider: "development-fixture",
    image: Buffer.from(svg, "utf8"),
    mime: "image/svg+xml",
    mockNote: "Fixture image (labeled SVG) - not a real generated thumbnail.",
  };
}
