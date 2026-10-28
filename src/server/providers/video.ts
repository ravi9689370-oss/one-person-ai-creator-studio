/**
 * Video adapter. Real video rendering beyond provider APIs is a job handled by
 * an external renderer; this adapter exposes the boundary + a verified mock
 * that produces a labeled placeholder MP4/SVG artifact so downstream steps
 * (captions, publishing packages, approval previews) can be exercised.
 */
import { providerEnv } from "@/lib/env";
import { ProviderError } from "./llm";

export type VideoResult = {
  mode: "real" | "mock";
  provider: string;
  video: Buffer;
  mime: string;
  mockNote?: string;
};

export type VideoCapability = "assemble_only" | "provider_generation";

export function videoConfigured(): { provider: string; configured: boolean; capability: VideoCapability } {
  const env = providerEnv();
  if (env.higgsfieldApiKey) return { provider: "higgsfield", configured: true, capability: "provider_generation" };
  // ffmpeg renders are handled by the render job (see worker); if absent we only
  // support assembling packages - no fake MP4s get produced.
  return { provider: "mock", configured: false, capability: "assemble_only" };
}

const TIMEOUT_MS = 120_000;

export async function generateVideo(opts: {
  storyboard: string;
  voiceJobRef?: string;
  mock?: boolean;
  mockFail?: boolean;
}): Promise<VideoResult> {
  const env = providerEnv();
  if (!opts.mock && env.higgsfieldApiKey) {
    // Boundary for a real Higgsfield API call (payload shape verified when
    // credentials are supplied). Deliberately fails closed rather than faking.
    const res = await fetch("https://api.higgsfield.ai/v1/generations", {
      method: "POST",
      headers: { authorization: `Bearer ${env.higgsfieldApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ prompt: opts.storyboard.slice(0, 1500), input: { voiceJobRef: opts.voiceJobRef } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ProviderError("higgsfield", `HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }
    const json = (await res.json()) as { video_base64?: string };
    if (!json.video_base64) throw new ProviderError("higgsfield", "Provider returned no video payload.");
    return { mode: "real", provider: "higgsfield", video: Buffer.from(json.video_base64, "base64"), mime: "video/mp4" };
  }
  if (opts.mockFail) throw new ProviderError("mock-video", "Fixture simulated failure (test hook).");
  throw new ProviderError(
    "mock-video",
    "No video provider configured. The assemble-only pipeline can package approved assets, but synthetic MP4 output is intentionally not produced by the mock adapter (see docs/architecture.md#video)."
  );
}
