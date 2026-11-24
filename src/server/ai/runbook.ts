// Server-only. A step-by-step runbook for one glitch: written by Claude from the glitch, its echoes
// and its type, or taken from a per-type template when Claude is not available.
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index.ts";
import { echoes, glitches } from "#/db/schema.ts";
import {
  GLITCH_TYPE_INFO,
  type GlitchType,
  type RunbookStep,
} from "#/lib/glitch.ts";
import { askStructured } from "./llm";
import type { Source } from "./triage";

const RunbookSchema = z.object({
  steps: z
    .array(
      z.object({
        title: z.string().describe("short imperative, max 6 words"),
        detail: z.string().describe("one or two sentences"),
      }),
    )
    .describe("4 to 7 steps, in order"),
});

const SYSTEM = `You write runbooks for the guardians of Achrona, who defend a magical grid against "The Desync".
A runbook is a short ordered checklist a defender can follow right now to contain and fix one glitch.
Steps are concrete: where to look, what to measure (mana load, latency, core temperature, sync drift on the dashboard), what to do, and how to know it worked.
The last step is always to confirm the fix (stabilize the signal in the app, then report an echo).
Stay in the world of Achrona; do not invent real-world software or people.`;

/** Fallback runbook per glitch type. */
const TEMPLATES: Record<GlitchType, RunbookStep[]> = {
  temporal: [
    {
      title: "Check the latency chart",
      detail:
        "Open Vitals and look for latency spikes at the time of the report.",
    },
    {
      title: "Find the looping node",
      detail:
        "On the map, look for the town whose latency or drift keeps returning to the same value.",
    },
    {
      title: "Isolate its ley lines",
      detail:
        "Ask the commander to watch the neighbours of that town for spreading corruption.",
    },
    {
      title: "Reset the clockwork",
      detail:
        "Move the glitch to Containing and play the Chrono-Pulse lock to re-align the timeline.",
    },
    {
      title: "Confirm with an echo",
      detail: "Report what you did and whether the loop stopped.",
    },
  ],
  mana: [
    {
      title: "Read the mana load",
      detail: "Open the node card and compare mana load to the 97% limit.",
    },
    {
      title: "Check for a drain",
      detail:
        "A sudden drop on one node usually means a leak; a slow climb means overload.",
    },
    {
      title: "Spread the load",
      detail:
        "Warn the neighbouring towns and keep an eye on the early warnings.",
    },
    {
      title: "Stabilize",
      detail: "Move the glitch to Containing and stabilize the signal.",
    },
    {
      title: "Confirm with an echo",
      detail: "Report the new mana level once it is back in the normal band.",
    },
  ],
  thermal: [
    {
      title: "Check core temperature",
      detail:
        "Open the node and compare core temp to the 85 °C limit and the forecast line.",
    },
    {
      title: "Look for a build-up",
      detail:
        "A rising early warning means the heat is still climbing: act before the ETA.",
    },
    {
      title: "Cool the core",
      detail:
        "Move the glitch to Containing and stabilize the signal to vent the heat.",
    },
    {
      title: "Watch the neighbours",
      detail:
        "Heat can spread along ley lines; check the threatened towns on the map.",
    },
    {
      title: "Confirm with an echo",
      detail: "Report the temperature once it is back under the limit.",
    },
  ],
  desync: [
    {
      title: "Read the sync drift",
      detail:
        "Open Vitals and check sync drift on all nodes; a Desync wave hits several at once.",
    },
    {
      title: "Map the spread",
      detail: "On the map, follow the magenta pulses from the corrupted towns.",
    },
    {
      title: "Protect the neighbours",
      detail:
        "Assign defenders to the threatened towns before the corruption reaches them.",
    },
    {
      title: "Re-align the signal",
      detail:
        "Move the glitch to Containing and tune the signal back onto the ghost wave.",
    },
    {
      title: "Confirm with an echo",
      detail: "Report when drift is back under 50 ms on every affected node.",
    },
  ],
  portal: [
    {
      title: "Locate the rift",
      detail: "Find the town in the report on the map and open its node page.",
    },
    {
      title: "Check for corruption",
      detail: "Purple tiles around the town mean the rift is spreading.",
    },
    {
      title: "Seal the area",
      detail:
        "Ask other guardians to stay clear and report any new flicker as an echo.",
    },
    {
      title: "Close the rift",
      detail: "Move the glitch to Containing and stabilize the signal.",
    },
    {
      title: "Confirm with an echo",
      detail: "Report when the flicker has stopped.",
    },
  ],
  signal: [
    {
      title: "Check the sensors",
      detail:
        "Compare the node’s four metrics with its neighbours; one odd metric points at a sensor.",
    },
    {
      title: "Look at the anomaly log",
      detail: "Filter the Anomalies tab on this node to see when it started.",
    },
    {
      title: "Recalibrate",
      detail: "Move the glitch to Containing and stabilize the signal.",
    },
    {
      title: "Watch for repeats",
      detail:
        "If the same echo comes back, reopen this glitch instead of making a new one.",
    },
    {
      title: "Confirm with an echo",
      detail: "Report that the readings are normal again.",
    },
  ],
  other: [
    {
      title: "Gather echoes",
      detail:
        "Ask the reporter for where and when it happened, and what they saw.",
    },
    {
      title: "Check the dashboard",
      detail:
        "Look for alerts and early warnings around the time of the report.",
    },
    {
      title: "Assess",
      detail:
        "Move the glitch to Assessing and write down what you find as echoes.",
    },
    {
      title: "Contain and stabilize",
      detail: "Move it to Containing and stabilize the signal.",
    },
    {
      title: "Confirm with an echo",
      detail: "Report what fixed it, so the next guardian knows.",
    },
  ],
};

/** Write (or rewrite) the runbook of a glitch and store it. */
export async function writeRunbook(
  glitchId: string,
): Promise<{ steps: RunbookStep[]; source: Source }> {
  const glitch = db
    .select()
    .from(glitches)
    .where(eq(glitches.glitchId, glitchId))
    .get();
  if (!glitch) throw new Error(`Glitch ${glitchId} no longer exists`);
  const type = glitch.glitchType ?? "other";
  const history = db
    .select()
    .from(echoes)
    .where(eq(echoes.glitchId, glitchId))
    .orderBy(asc(echoes.timestamp))
    .all();

  const ai = await askStructured(
    RunbookSchema,
    SYSTEM,
    [
      `Glitch ${glitch.glitchId} (${glitch.status}, type ${GLITCH_TYPE_INFO[type].label}): "${glitch.description}"`,
      "Echoes so far:",
      ...history.map((e) => `- ${e.timestamp}: ${e.description}`),
    ].join("\n"),
    "medium",
  );

  const steps = ai?.steps.length ? ai.steps.slice(0, 8) : TEMPLATES[type];
  const source: Source = ai?.steps.length ? "ai" : "rules";
  db.update(glitches)
    .set({ runbook: JSON.stringify(steps), runbookSource: source })
    .where(eq(glitches.glitchId, glitchId))
    .run();
  return { steps, source };
}
