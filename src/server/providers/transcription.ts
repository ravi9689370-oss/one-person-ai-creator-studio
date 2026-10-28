/**
 * Transcription adapter (OpenAI Whisper-compatible + labeled dev fixture).
 */
import { providerEnv } from "@/lib/env";
import { ProviderError } from "./llm";

export type TranscriptionResult = {
  mode: "real" | "mock";
  provider: string;
  text: string;
  language?: string;
  mockNote?: string;
};

export function transcriptionConfigured(): { provider: string; configured: boolean } {
  const env = providerEnv();
  if (env.openaiApiKey) return { provider: "openai", configured: true };
  return { provider: "mock", configured: false };
}

const TIMEOUT_MS = 180_000;

export async function transcribe(opts: {
  audio: Buffer;
  mime: string;
  fileName: string;
  language?: string;
  mock?: boolean;
  mockFail?: boolean;
}): Promise<TranscriptionResult> {
  const env = providerEnv();
  if (!opts.mock && env.openaiApiKey) {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(opts.audio)], { type: opts.mime }), opts.fileName || "audio.wav");
    form.append("model", "whisper-1");
    form.append("response_format", "json");
    if (opts.language) form.append("language", opts.language);
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${env.openaiApiKey}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ProviderError("openai-whisper", `HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }
    const json = (await res.json()) as { text?: string; language?: string };
    const text = (json.text ?? "").trim();
    if (!text) throw new ProviderError("openai-whisper", "Provider returned no transcript text.");
    return { mode: "real", provider: "openai-whisper", text, language: json.language };
  }
  if (opts.mockFail) throw new ProviderError("mock-asr", "Fixture simulated failure (test hook).");
  return {
    mode: "mock",
    provider: "development-fixture",
    text:
      "[DEVELOPMENT FIXTURE TRANSCRIPT] Configure OPENAI_API_KEY for real transcription. " +
      "This fixture mirrors the audio duration with placeholder sentences so downstream pipelines can be exercised.",
    language: opts.language ?? "en",
    mockNote: "Fixture transcript - not real speech-to-text output.",
  };
}
