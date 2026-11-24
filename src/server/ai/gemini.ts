// Server-only. Google Gemini (Flash) as the AI engine, through the official Google Gen AI SDK.
// Same contract as claude.ts: every helper returns null when Gemini is not available,
// so each AI feature falls back to its rules.
import { GoogleGenAI, type GenerateContentConfig } from "@google/genai";
import { z } from "zod";

/**
 * Models to try, in order. The first one is GEMINI_MODEL from .env when set.
 * Busy (503), rate-limited (429) or unknown (404) models are skipped for the next one,
 * because the free tier often has one model overloaded while another one is fine.
 */
const DEFAULT_MODELS = [
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite",
];

function modelChain() {
  const pinned = process.env.GEMINI_MODEL;
  return pinned
    ? [pinned, ...DEFAULT_MODELS.filter((m) => m !== pinned)]
    : DEFAULT_MODELS;
}

/** The model that is tried first (shown in the UI). */
export function geminiModel() {
  return modelChain()[0];
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

let client: GoogleGenAI | null = null;
function getClient() {
  client ??= new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    // v1beta: the v1 API does not accept system instructions or JSON schemas.
    // 20 s timeout: an operator is waiting on these calls.
    httpOptions: { apiVersion: "v1beta", timeout: 20_000 },
  });
  return client;
}

/** HTTP status of a Gemini error, if it has one. */
function statusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : undefined;
}

/** Run one request on the first model that is not busy. Returns the response text, or null. */
async function generate(
  kind: string,
  contents: Parameters<GoogleGenAI["models"]["generateContent"]>[0]["contents"],
  config: GenerateContentConfig,
) {
  if (!geminiConfigured()) return null;
  for (const model of modelChain()) {
    try {
      const response = await getClient().models.generateContent({
        model,
        contents,
        config,
      });
      return response.text?.trim() || null;
    } catch (error) {
      const status = statusOf(error);
      const retryable =
        status === 503 || status === 429 || status === 404 || status === 500;
      console.warn(
        `[ai] gemini ${kind} on ${model}: ${status ?? ""} ${error instanceof Error ? error.message.slice(0, 160) : String(error)}`,
      );
      if (!retryable) return null;
    }
  }
  console.warn(
    `[ai] gemini ${kind}: every model busy, using the rules instead`,
  );
  return null;
}

/** Ask for JSON that matches `schema` (Gemini's JSON mode with the schema). Null on any failure. */
export async function geminiStructured<T extends z.ZodType>(
  schema: T,
  system: string,
  user: string,
): Promise<z.infer<T> | null> {
  const text = await generate("structured", user, {
    systemInstruction: system,
    responseMimeType: "application/json",
    responseJsonSchema: z.toJSONSchema(schema),
  });
  if (!text) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** A plain-text answer. `messages` is the conversation so far, ending with the user's turn. */
export async function geminiText(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<string | null> {
  return generate(
    "text",
    // Gemini calls the assistant role "model".
    messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { systemInstruction: system },
  );
}
