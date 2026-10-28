import { describe, expect, it } from "vitest";
import { callLlm, llmConfigured, mockLlm } from "@/server/providers/llm";
import { generateVideo, videoConfigured } from "@/server/providers/video";
import { imageConfigured, generateImage } from "@/server/providers/image";
import { ttsConfigured, synthesizeSpeech } from "@/server/providers/tts";
import { transcribe, transcriptionConfigured } from "@/server/providers/transcription";

describe("provider adapters without credentials", () => {
  it("LLM runs in labeled dev-fixture mode", async () => {
    expect(llmConfigured().configured).toBe(false);
    const res = await callLlm({ system: "You write scripts.", user: "Write about topic: creator burnout" });
    expect(res.mode).toBe("mock");
    expect(res.text).toContain("DEVELOPMENT FIXTURE");
  });

  it("mockLlm output labels itself as a fixture and stays deterministic", () => {
    const a = mockLlm("system", "topic: growth");
    const b = mockLlm("system", "topic: growth");
    expect(a.mode).toBe("mock");
    expect(a.text).toBe(b.text);
    expect(a.text).toContain("DEVELOPMENT FIXTURE");
  });

  it("TTS/transcription/image adapters run in labeled dev-fixture mode without credentials", async () => {
    expect(ttsConfigured().configured).toBe(false);
    expect(transcriptionConfigured().configured).toBe(false);
    expect(imageConfigured().configured).toBe(false);
    expect(imageConfigured().provider).toBe("mock");

    const img = await generateImage({ prompt: "thumbnail: neon workspace" });
    expect(img.mode).toBe("mock");
    expect(img.image.toString("utf8")).toContain("DEVELOPMENT FIXTURE IMAGE");

    const speech = await synthesizeSpeech({ text: "hello studio", language: "en" });
    expect(speech.mode).toBe("mock");
    expect(speech.mockNote).toContain("DEVELOPMENT FIXTURE");
    expect(speech.audio.subarray(0, 4).toString("ascii")).toBe("RIFF");

    const tr = await transcribe({ audio: Buffer.from("x"), mime: "audio/wav", fileName: "note.wav", language: "en" });
    expect(tr.mode).toBe("mock");
    expect(tr.text).toContain("DEVELOPMENT FIXTURE TRANSCRIPT");
  });

  it("video rendering fails closed - the mock adapter never fabricates an MP4", async () => {
    const cfg = videoConfigured();
    expect(cfg.configured).toBe(false);
    expect(cfg.provider).toBe("mock");
    await expect(generateVideo({ storyboard: "three shots", voiceJobRef: "voice:1" })).rejects.toThrow(/mock/i);
    await expect(generateVideo({ storyboard: "s", mockFail: true })).rejects.toThrow(/Fixture simulated failure/);
  });
});
