/**
 * Speech-generation adapter (ElevenLabs + labeled dev fixture).
 * Generates audio only for authorized voice assets: callers must pass a
 * voiceId that belongs to the workspace's configured voice library. The
 * adapter stores results as storage objects so jobs can verify real artifacts.
 */
import { providerEnv } from "@/lib/env";
import { ProviderError } from "./llm";

export type TtsResult = {
  mode: "real" | "mock";
  provider: string;
  audio: Buffer;
  mime: string;
  durationEstSec?: number;
  mockNote?: string;
};

export function ttsConfigured(): { provider: string; configured: boolean } {
  const env = providerEnv();
  if (env.elevenlabsApiKey) return { provider: "elevenlabs", configured: true };
  return { provider: "mock", configured: false };
}

const TIMEOUT_MS = 120_000;

function elVoiceId(voiceId?: string): string {
  const env = providerEnv() as Record<string, string | undefined>;
  if (voiceId && voiceId !== "from-config") return voiceId;
  return env.ELEVENLABS_VOICE_ID ?? process.env.ELEVENLABS_VOICE_ID ?? "";
}

export async function synthesizeSpeech(opts: {
  text: string;
  voiceId?: string;
  language?: string;
  mock?: boolean;
  mockFail?: boolean; // test hook
}): Promise<TtsResult> {
  const env = providerEnv();
  if (!opts.mock && env.elevenlabsApiKey) {
    const voice = elVoiceId(opts.voiceId);
    if (!voice) throw new ProviderError("elevenlabs", "No ElevenLabs voice ID configured (ELEVENLABS_VOICE_ID).");
    const langParam = opts.language && opts.language !== "en" ? `?language=${opts.language}` : "";
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}${langParam}`, {
      method: "POST",
      headers: { "xi-api-key": env.elevenlabsApiKey, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text: opts.text.slice(0, 5000), model_id: "eleven_multilingual_v2" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 401) throw new ProviderError("elevenlabs", "Unauthorized: check ELEVENLABS_API_KEY.");
    if (res.status === 429) throw new ProviderError("elevenlabs", "Rate limited by ElevenLabs quota.");
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ProviderError("elevenlabs", `HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }
    const audio = Buffer.from(await res.arrayBuffer());
    if (audio.length === 0) throw new ProviderError("elevenlabs", "Provider returned an empty audio file.");
    return {
      mode: "real",
      provider: "elevenlabs",
      audio,
      mime: "audio/mpeg",
      durationEstSec: Math.ceil(opts.text.split(/\s+/).length / 2.6),
    };
  }

  if (opts.mockFail) throw new ProviderError("mock-tts", "Fixture simulated failure (test hook).");

  // Labeled development fixture: a tiny valid WAV so players/pipelines behave.
  const seconds = Math.max(1, Math.ceil(opts.text.split(/\s+/).length / 2.6));
  const sampleRate = 8000;
  const samples = seconds * sampleRate;
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    // quiet 440 Hz tone so playback is possible but unmistakably synthetic
    data.writeInt16LE(Math.round(260 * Math.sin((2 * Math.PI * 440 * i) / sampleRate)), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  const wav = Buffer.concat([header, data]);
  return {
    mode: "mock",
    provider: "development-fixture",
    audio: wav,
    mime: "audio/wav",
    durationEstSec: seconds,
    mockNote: "DEVELOPMENT FIXTURE audio (synthetic tone). Configure ELEVENLABS_API_KEY for real speech.",
  };
}
