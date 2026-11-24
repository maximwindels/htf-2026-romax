// Server-only. The Oracle's voice: Gemini text-to-speech with a deep voice and a wizard style prompt.
// Returns WAV audio (base64), or null when it is not available (no key, quota used, every model busy);
// the browser then falls back to its own speech synthesis.
import { GoogleGenAI } from "@google/genai";
import { geminiConfigured } from "./gemini";

/** Fastest first; busy (503), rate-limited (429) or unknown (404) models are skipped. */
const TTS_MODELS = [
  "gemini-3.8-flash-lite-tts",
  "gemini-2.5-flash-preview-tts",
  "gemini-3.1-flash-tts-preview",
];
/** A deep, steady prebuilt voice; override with GEMINI_TTS_VOICE in .env. */
const VOICE = () => process.env.GEMINI_TTS_VOICE || "Charon";

/**
 * How the text should sound. Gemini speech follows a director-style prompt: the notes set the
 * voice, and only the part under TRANSCRIPT is spoken. Without this split the model also
 * read the style instructions out loud.
 */
function speechPrompt(text: string) {
  return [
    "# AUDIO PROFILE: The Oracle of Achrona",
    "An ancient, wise wizard who watches over the grid from a stone tower.",
    "",
    "### DIRECTOR'S NOTES",
    "Style: deep, slow, slightly gravelly, calm and mysterious, with dramatic pauses.",
    "Read ONLY the transcript below, word for word. Do not read these notes, headings or labels.",
    "",
    "#### TRANSCRIPT",
    text,
  ].join("\n");
}

/** Longest text we send: about 30 seconds of speech, so a long answer can't run forever. */
const MAX_CHARS = 700;

let client: GoogleGenAI | null = null;
function getClient() {
  client ??= new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    httpOptions: { apiVersion: "v1beta", timeout: 40_000 },
  });
  return client;
}

/** Recent results, so pressing Speak twice on the same answer costs one call. */
const cache = new Map<string, string>();

/** Make the text speakable: no bullets, at most MAX_CHARS, cut at the end of a sentence. */
export function speakableText(text: string) {
  const plain = text
    .replace(/[•*#_`]/g, "")
    .replace(/\s*\n+\s*/g, ". ")
    .replace(/\.\s*\./g, ".")
    .trim();
  if (plain.length <= MAX_CHARS) return plain;
  const cut = plain.slice(0, MAX_CHARS);
  const end = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf("! "),
    cut.lastIndexOf("? "),
  );
  return (
    (end > 200 ? cut.slice(0, end + 1) : cut) +
    " The rest, guardian, you may read in the crystal."
  );
}

/** 16-bit mono PCM to a WAV file. */
function pcmToWav(pcm: Buffer, sampleRate: number) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Speak `text` in the wizard voice. Returns base64 WAV, or null. */
export async function wizardVoice(
  text: string,
): Promise<{ audio: string; model: string } | null> {
  if (!geminiConfigured()) return null;
  const speech = speakableText(text);
  const cached = cache.get(speech);
  if (cached) return { audio: cached, model: "cache" };

  for (const model of TTS_MODELS) {
    try {
      const response = await getClient().models.generateContent({
        model,
        contents: speechPrompt(speech),
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE() } },
          },
        },
      });
      const part = response.candidates?.[0]?.content?.parts?.find(
        (p) => p.inlineData?.data,
      );
      if (!part?.inlineData?.data) continue;
      const mime = (part.inlineData.mimeType ?? "").toLowerCase();
      const bytes = Buffer.from(part.inlineData.data, "base64");
      // Some models return WAV, others raw 16-bit PCM ("audio/L16; rate=24000").
      const wav = mime.includes("wav")
        ? bytes
        : pcmToWav(bytes, Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000));
      const audio = wav.toString("base64");
      cache.set(speech, audio);
      if (cache.size > 30) cache.delete(cache.keys().next().value!);
      return { audio, model };
    } catch (error) {
      const status = (error as { status?: unknown })?.status;
      console.warn(
        `[ai] voice on ${model}: ${status ?? ""} ${error instanceof Error ? error.message.slice(0, 140) : String(error)}`,
      );
      if (status !== 503 && status !== 429 && status !== 404 && status !== 500)
        return null;
    }
  }
  return null;
}
