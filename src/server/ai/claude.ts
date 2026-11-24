// Server-only. The one place that talks to Claude.
// Every helper returns null when Claude is not available (no key, no network, refusal, error),
// so each AI feature can fall back to its rule-based version and the demo keeps working offline.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

/** Default model for every AI feature. */
export const AI_MODEL = "claude-opus-5-5";

// Load ANTHROPIC_API_KEY from a .env file in the project root (Node 22+ built-in). Missing file = fine.
try {
  process.loadEnvFile();
} catch {
  // no .env: the key can still come from the shell environment
}

/** True when a Claude credential is configured. Without one, every feature uses its rules. */
export function aiEnabled(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
  );
}

let client: Anthropic | null = null;
function getClient() {
  // Short timeout and one retry: an operator is waiting on these calls.
  client ??= new Anthropic({ timeout: 25_000, maxRetries: 1 });
  return client;
}

/**
 * The refusal fallback is opted in on every call: if Claude declines a request,
 * the API retries it on a fallback model inside the same call (server-side).
 */
const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

type Effort = "low" | "medium" | "high";

/** Ask for JSON that matches `schema`. Returns null when Claude is unavailable or the answer can't be parsed. */
export async function askStructured<T extends z.ZodType>(
  schema: T,
  system: string,
  user: string,
  effort: Effort = "low",
): Promise<z.infer<T> | null> {
  if (!aiEnabled()) return null;
  try {
    const response = await getClient().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 4096,
      ...FALLBACK,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { effort, format: betaZodOutputFormat(schema) },
    });
    if (response.stop_reason === "refusal") return null;
    return (response.parsed_output as z.infer<T> | null) ?? null;
  } catch (error) {
    logError("structured", error);
    return null;
  }
}

/** A plain-text answer (chat). `messages` is the conversation so far, ending with the user's turn. */
export async function askText(
  system: string,
  messages: Anthropic.Beta.BetaMessageParam[],
  effort: Effort = "low",
): Promise<string | null> {
  if (!aiEnabled()) return null;
  try {
    const response = await getClient().beta.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      system,
      messages,
      output_config: { effort },
    });
    if (response.stop_reason === "refusal") return null;
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return text || null;
  } catch (error) {
    logError("text", error);
    return null;
  }
}

function logError(kind: string, error: unknown) {
  if (error instanceof Anthropic.AuthenticationError) {
    console.warn(
      `[ai] ${kind}: the API key was rejected, using the rules instead`,
    );
  } else if (error instanceof Anthropic.RateLimitError) {
    console.warn(`[ai] ${kind}: rate limited, using the rules instead`);
  } else if (error instanceof Anthropic.APIError) {
    console.warn(
      `[ai] ${kind}: API error ${error.status}, using the rules instead`,
    );
  } else {
    console.warn(
      `[ai] ${kind}: ${error instanceof Error ? error.message : String(error)}, using the rules instead`,
    );
  }
}
