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
import { askText } from "./llm";
import type { Source } from "./triage";

export type ChatTurn = { role: "user" | "assistant"; text: string };

const SYSTEM = `You are the Oracle of Achrona's mission control. Operators (the guardians) ask you about active incidents, alerts and the state of the grid.
Answer from the live snapshot you get with each question. Be brief: a few sentences or a short list. Name nodes, glitch ids and numbers so they can act.
If the snapshot does not contain the answer, say so instead of guessing. Plain text, no markdown headings.`;

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
  return [
    "The Oracle is offline (no AI key configured), so here is the live summary instead:",
    `• Open alerts: ${s.openBySeverity.critical} critical, ${s.openBySeverity.high} high, ${s.openBySeverity.medium} medium.`,
    `• Early warnings active: ${forecasts.length}.`,
    `• Newest open glitches: ${open.map((g) => `${g.glitchId} (${g.status.toLowerCase()})`).join(", ") || "none"}.`,
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
