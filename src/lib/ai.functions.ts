import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "#/db/index.ts";
import { echoes, glitches } from "#/db/schema.ts";
import { requireGuardian } from "#/lib/auth.server.ts";
import { announce } from "#/lib/glitches.server.ts";
import { nextId } from "#/lib/ids.server.ts";
import type { RunbookStep } from "#/lib/glitch.ts";
import { aiEnabled, aiLabel } from "#/server/ai/llm.ts";
import { askOracle, type ChatTurn } from "#/server/ai/assistant.ts";
import { writeRunbook } from "#/server/ai/runbook.ts";
import { addAiNote, typeByRules } from "#/server/ai/triage.ts";

/** Which AI engine is active (Gemini, Claude or rules)? The UI shows it in the Oracle. */
export const getAiStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    requireGuardian();
    return { enabled: aiEnabled(), model: aiLabel() };
  },
);

/** Any guardian: write (or rewrite) the runbook of a glitch. */
export const generateRunbook = createServerFn({ method: "POST" })
  .validator((glitchId: string) => String(glitchId))
  .handler(
    async ({
      data: glitchId,
    }): Promise<{ steps: RunbookStep[]; source: string }> => {
      requireGuardian();
      const result = await writeRunbook(glitchId);
      addAiNote(
        glitchId,
        "runbook",
        `Runbook written (${result.steps.length} steps)`,
        result.source,
      );
      announce(glitchId);
      return result;
    },
  );

/** Any guardian: ask the Oracle about the grid. `history` is the chat so far (oldest first). */
export const askAssistant = createServerFn({ method: "POST" })
  .validator((data: { question: string; history?: ChatTurn[] }) => {
    const question = String(data?.question ?? "").trim();
    if (!question) throw new Error("Ask a question first");
    if (question.length > 1000)
      throw new Error("Keep the question under 1000 characters");
    const history = Array.isArray(data?.history)
      ? data.history
          .filter(
            (t) =>
              (t?.role === "user" || t?.role === "assistant") &&
              typeof t?.text === "string",
          )
          .map((t) => ({ role: t.role, text: String(t.text).slice(0, 4000) }))
      : [];
    return { question, history };
  })
  .handler(async ({ data }) => {
    requireGuardian();
    return askOracle(data.question, data.history);
  });

/**
 * Commander only: undo an AI grouping. Moves one echo out of its glitch into a new glitch of its own
 * (the override for "AI groups duplicate echoes").
 */
export const splitEcho = createServerFn({ method: "POST" })
  .validator((echoId: string) => String(echoId))
  .handler(async ({ data: echoId }): Promise<{ glitchId: string }> => {
    requireGuardian("commander");
    const echo = db
      .select()
      .from(echoes)
      .where(eq(echoes.echoId, echoId))
      .get();
    if (!echo) throw new Error("This echo no longer exists");
    const from = echo.glitchId;
    const glitchId = db.transaction((tx) => {
      const id = nextId(tx, "GL");
      tx.insert(glitches)
        .values({
          glitchId: id,
          status: "LEAKED",
          description: echo.description,
          timestamp: echo.timestamp,
          glitchType: typeByRules(echo.description),
        })
        .run();
      tx.update(echoes)
        .set({ glitchId: id })
        .where(eq(echoes.echoId, echoId))
        .run();
      return id;
    });
    addAiNote(
      from,
      "split",
      `A commander moved echo ${echoId} out to its own glitch ${glitchId}`,
      "rules",
    );
    addAiNote(
      glitchId,
      "split",
      `Split out of ${from} by a commander (AI grouping overruled)`,
      "rules",
    );
    announce(from);
    announce(glitchId);
    return { glitchId };
  });
