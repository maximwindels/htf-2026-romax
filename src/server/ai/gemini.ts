// Server-only. Google Gemini (Flash) as the AI engine, through the official Google Gen AI SDK.
// Same contract as claude.ts: every helper returns null when Gemini is not available,
// so each AI feature falls back to its rules.
import { GoogleGenAI, type GenerateContentConfig } from "@google/genai";
import { z } from "zod";

/**
 * Models to try, in order. The first one is GEMINI_MODEL from .env when set.
 * On the free tier one model is often out of quota or overloaded while another one is fine,
 * so a failing model hands the request to the next one. The fast lite model comes second:
 * it is rarely busy.
 */
const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'];

function modelChain() {
  const pinned = process.env.GEMINI_MODEL;
  return pinned
    ? [pinned, ...DEFAULT_MODELS.filter((m) => m !== pinned)]
    : DEFAULT_MODELS;
}

/**
 * Models that failed recently are skipped until this time (ms), so the operator does not wait
 * for a model that is known to be out of quota (429: 10 minutes) or overloaded (2 minutes).
 */
const restingUntil = new Map<string, number>();

function rest(model: string, status: number | undefined) {
  const minutes = status === 429 ? 10 : status === 404 ? 60 : 2;
  restingUntil.set(model, Date.now() + minutes * 60_000);
}

/** The models to try now: the ones that are not resting, or all of them if every one is. */
function availableModels() {
  const now = Date.now();
  const awake = modelChain().filter((m) => (restingUntil.get(m) ?? 0) <= now);
  return awake.length ? awake : modelChain();
}

/** Errors that will not get better on another model: a bad request or a bad key. */
function isPermanent(status: number | undefined) {
  return status === 400 || status === 401 || status === 403;
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
  for (const model of availableModels()) {
    try {
      const response = await getClient().models.generateContent({
        model,
        contents,
        config,
      });
      restingUntil.delete(model);
      return response.text?.trim() || null;
    } catch (error) {
      const status = statusOf(error);
      console.warn(
        `[ai] gemini ${kind} on ${model}: ${status ?? "timeout"} ${error instanceof Error ? error.message.slice(0, 160) : String(error)}`,
      );
      // A bad request or key fails on every model; anything else (quota, busy, timeout) may work on the next one.
      if (isPermanent(status)) return null;
      rest(model, status);
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
