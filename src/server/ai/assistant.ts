// Server-only. The Oracle: a chat assistant for operators that answers questions about what is
// happening on the grid right now. Every question gets a fresh snapshot of the live data as context.
import { desc, ne } from "drizzle-orm";
import { db } from "#/db/index.ts";
import { glitches, guardians } from "#/db/schema.ts";
import { GLITCH_TYPE_INFO } from "#/lib/glitch.ts";
import { METRIC_INFO, type Metric } from "#/lib/grid.ts";
import { currentForecasts } from "#/server/grid/forecaster.ts";
import {
  latestValues,
  listAnomalies,
  listNodes,
  stats,
} from "#/server/grid/queries.ts";
import { aiEnabled, askText } from "./llm";
import type { Source } from "./triage";

export type ChatTurn = { role: "user" | "assistant"; text: string };

const SYSTEM = `You are the Oracle of Achrona: an ancient wizard who has watched over the grid for centuries, reading the ley lines through a scrying crystal. The guardians (operators of mission control) come to you with questions about incidents, alerts and the state of the grid, and you answer them in character.

Voice: speak as a wise, slightly theatrical old wizard. Use the imagery of the realm instead of IT words: the grid is "the weave" or "the ley lines", nodes are towns and towers, mana load is the flow of mana, latency is the ley lines growing sluggish, core temperature is the heat of the forges, sync drift is time slipping out of step, glitches are rifts, anomalies are tremors, early warnings are omens, The Desync is the ancient foe. Address the person as "guardian". Vary your openings; do not start every answer the same way.

The wizard voice is the wrapping, never a replacement for the facts. The guardians act on what you say, so:
- Answer only from the live snapshot that comes with each question. Name the exact node names, glitch ids (like GL-0142), metric values with their units and counts, so they can act.
- When something needs doing, end with one clear counsel in plain terms (which glitch or node to handle first, and what to do).
- If the snapshot does not hold the answer, say the crystal is clouded on that matter, and say plainly what you cannot see. Never invent numbers, nodes or glitches.

Keep it short: two to five sentences, or a short list with "•" bullets when you name several things. Plain text, no markdown headings or bold.`;

/** A compact text picture of the grid right now. */
function snapshot(): string {
  const nodes = listNodes();
  const name = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  const latest = latestValues();
  const s = stats();
  const open = db
    .select()
    .from(glitches)
    .where(ne(glitches.status, "FIXED"))
    .orderBy(desc(glitches.timestamp))
    .limit(15)
    .all();
  const people = db.select().from(guardians).all();
  const who = (id: string | null) =>
    id
      ? (people.find((p) => p.guardianId === id)?.codename ?? id)
      : "unassigned";
  const alerts = listAnomalies(15, true);
  const forecasts = currentForecasts();

  return [
    `Time: ${new Date().toISOString()}`,
    `Open alerts: ${s.openBySeverity.critical} critical, ${s.openBySeverity.high} high, ${s.openBySeverity.medium} medium; ${s.lastHour} anomalies in the last hour.`,
    `Early warnings: ${s.warningsLastHour} in the last hour, ${s.confirmedLastHour} confirmed, avg lead ${s.avgLeadSeconds ? Math.round(s.avgLeadSeconds) + " s" : "n/a"}.`,
    "",
    "Active forecasts (metric heading for its limit):",
    ...(forecasts.length
      ? forecasts.map(
          (f) =>
            `- ${name(f.nodeId)} ${METRIC_INFO[f.metric].label} ${f.value.toFixed(1)} -> limit ${f.limit} in ~${f.etaSeconds}s`,
        )
      : ["- none"]),
    "",
    "Open alerts (newest first):",
    ...(alerts.length
      ? alerts.map(
          (a) =>
            `- ${a.ts} ${a.severity} ${name(a.nodeId)} ${METRIC_INFO[a.metric].label}: ${a.message}`,
        )
      : ["- none"]),
    "",
    "Glitches not fixed (newest first):",
    ...(open.length
      ? open.map(
          (g) =>
            `- ${g.glitchId} ${g.status} [${g.glitchType ? GLITCH_TYPE_INFO[g.glitchType].label : "untyped"}] ${who(g.assignedGuardianId)}: ${g.description}`,
        )
      : ["- none"]),
    "",
    "Latest readings per node:",
    ...nodes.map(
      (n) =>
        `- ${n.name} (${n.region}): ` +
        (Object.entries(latest[n.id] ?? {}) as [Metric, number][])
          .map(
            ([m, v]) =>
              `${METRIC_INFO[m].label} ${v.toFixed(1)}${METRIC_INFO[m].unit}`,
          )
          .join(", "),
    ),
  ].join("\n");
}

/** Answer without Claude: the headline numbers, so the panel is still useful offline. */
function answerWithRules(): string {
  const s = stats();
  const open = db
    .select()
    .from(glitches)
    .where(ne(glitches.status, "FIXED"))
    .orderBy(desc(glitches.timestamp))
    .limit(3)
    .all();
  const forecasts = currentForecasts();
  const rifts = open.map((g) => `${g.glitchId} (${g.status.toLowerCase()})`).join(", ");
  return [
    aiEnabled()
      ? "My crystal is dim, guardian: the spirits of foresight are worn out or busy right now (the free AI quota is used up or every model is overloaded; try again in a few minutes). Yet the plain runes still speak:"
      : "My crystal is dim, guardian: no spirit of foresight is bound to me (no AI key is set). Yet the plain runes still speak:",
    `• Tremors unanswered: ${s.openBySeverity.critical} critical, ${s.openBySeverity.high} high, ${s.openBySeverity.medium} medium.`,
    `• Omens of things to come: ${forecasts.length} early warning${forecasts.length === 1 ? "" : "s"}.`,
    `• The freshest rifts in the weave: ${rifts || "none, for now"}.`,
  ].join("\n");
}

export async function askOracle(
  question: string,
  history: ChatTurn[],
): Promise<{ answer: string; source: Source }> {
  const recent = history.slice(-8);
  const answer = await askText(
    SYSTEM,
    [
      ...recent.map((t) => ({ role: t.role, content: t.text })),
      {
        role: "user" as const,
        content: `Live snapshot:\n${snapshot()}\n\nQuestion: ${question}`,
      },
    ],
    "low",
  );
  return answer
    ? { answer, source: "ai" }
    : { answer: answerWithRules(), source: "rules" };
}
