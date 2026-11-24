// Server-only. AI triage of echoes and glitches, with a rule-based fallback for every decision.
//
// One Claude call per echo answers five questions at once:
//   1. moderation  - is this a real report, or spam / gibberish / abuse?
//   2. type        - what kind of glitch is it (temporal, mana, thermal, ...)?
//   3. duplicate   - is it the same problem as an open (or recently fixed) glitch?
//   4. resolved    - does an update say the problem is gone?
//   5. assignment  - which defender should take a new glitch?
import { and, desc, eq, gt, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index.ts";
import { aiNotes, glitches, guardians } from "#/db/schema.ts";
import {
  GLITCH_TYPE_INFO,
  GLITCH_TYPES,
  type AiAction,
  type GlitchStatus,
  type GlitchType,
} from "#/lib/glitch.ts";
import { askStructured } from "./llm";

export type Source = "ai" | "rules";

export interface Triage {
  source: Source;
  accept: boolean;
  rejectReason: string;
  glitchType: GlitchType;
  /** id of the glitch this echo is about, when it duplicates one */
  duplicateOf: string | null;
  /** the echo says the problem is gone */
  resolves: boolean;
  /** defender for a new glitch */
  assignTo: string | null;
  /** one sentence: why */
  reason: string;
}

interface Candidate {
  glitchId: string;
  status: GlitchStatus;
  type: GlitchType | null;
  description: string;
  timestamp: string;
}

interface Defender {
  guardianId: string;
  codename: string;
  openAssignments: number;
  /** glitches per type this defender has been assigned to (experience) */
  experience: Partial<Record<GlitchType, number>>;
}

// ---------- context ----------

/** Glitches a new echo could belong to: everything not fixed, plus what was fixed in the last 3 days (to reopen). */
function candidates(): Candidate[] {
  const recentFixed = new Date(Date.now() - 3 * 24 * 3600_000).toISOString();
  const open = db
    .select()
    .from(glitches)
    .where(ne(glitches.status, "FIXED"))
    .orderBy(desc(glitches.timestamp))
    .limit(300)
    .all();
  const fixed = db
    .select()
    .from(glitches)
    .where(
      and(eq(glitches.status, "FIXED"), gt(glitches.timestamp, recentFixed)),
    )
    .orderBy(desc(glitches.timestamp))
    .limit(10)
    .all();
  return [...open, ...fixed].map((g) => ({
    glitchId: g.glitchId,
    status: g.status,
    type: g.glitchType ?? null,
    description: g.description,
    timestamp: g.timestamp,
  }));
}

function defenders(): Defender[] {
  const all = db.select().from(glitches).all();
  return db
    .select()
    .from(guardians)
    .where(eq(guardians.role, "defender"))
    .all()
    .map((d) => {
      const mine = all.filter((g) => g.assignedGuardianId === d.guardianId);
      const experience: Partial<Record<GlitchType, number>> = {};
      for (const g of mine)
        if (g.glitchType)
          experience[g.glitchType] = (experience[g.glitchType] ?? 0) + 1;
      return {
        guardianId: d.guardianId,
        codename: d.codename,
        openAssignments: mine.filter((g) => g.status !== "FIXED").length,
        experience,
      };
    });
}

// ---------- the Claude version ----------

const TriageSchema = z.object({
  accept: z
    .boolean()
    .describe("false only for spam, gibberish, empty or abusive text"),
  reject_reason: z
    .string()
    .describe("short reason when accept is false, else empty"),
  glitch_type: z.enum(GLITCH_TYPES),
  duplicate_of: z
    .string()
    .nullable()
    .describe("glitch id from the list when it is the same problem, else null"),
  resolves_glitch: z
    .boolean()
    .describe(
      "true only when the echo says the problem is gone or back to normal",
    ),
  assign_to: z
    .string()
    .nullable()
    .describe("guardianId of the best defender for a NEW glitch, else null"),
  reason: z.string().describe("one short sentence explaining the decisions"),
});

const SYSTEM = `You triage reports ("echoes") for the guardians of Achrona, a magical grid that is attacked by "The Desync".
Guardians report strange things they notice; you keep the glitch list clean.

Decide, for the echo you get:
- accept: false only for spam, gibberish, test noise, insults or anything that is not a report. Short but real reports are fine.
- glitch_type: ${GLITCH_TYPES.map((t) => `${t} (${GLITCH_TYPE_INFO[t].hint})`).join("; ")}.
- duplicate_of: only when the echo clearly describes the same problem (same kind of thing, same place if a place is named) as a listed glitch. When in doubt, null: a wrongly merged report hides a new problem.
- resolves_glitch: only for an update that says the problem is gone, fixed or back to normal.
- assign_to: for a new glitch, pick the defender with the most experience in this type, preferring fewer open assignments. null when there are no defenders.
Keep "reason" to one short sentence an operator can read at a glance.`;

async function triageWithClaude(
  text: string,
  target: Candidate | null,
  list: Candidate[],
  team: Defender[],
) {
  const context = [
    target
      ? `This echo is an UPDATE on glitch ${target.glitchId} (${target.status}, type ${target.type ?? "unknown"}): "${target.description}". Do not look for duplicates; decide resolves_glitch.`
      : "This echo is a NEW sighting. Check it against the glitches below.",
    "",
    "Glitches (id | status | type | description):",
    ...list.map(
      (g) =>
        `${g.glitchId} | ${g.status} | ${g.type ?? "-"} | ${g.description}`,
    ),
    "",
    "Defenders (guardianId | codename | open assignments | experience per type):",
    ...team.map(
      (d) =>
        `${d.guardianId} | ${d.codename} | ${d.openAssignments} | ${JSON.stringify(d.experience)}`,
    ),
    "",
    `Echo: "${text}"`,
  ].join("\n");
  return askStructured(TriageSchema, SYSTEM, context, "low");
}

// ---------- the rules version (offline fallback) ----------

const TYPE_WORDS: Record<GlitchType, RegExp> = {
  temporal: /\b(time|loop|clock|hour|delay|late|tijd|klok)/i,
  mana: /\b(mana|magic|reserve|load|energy|magie)/i,
  thermal: /\b(heat|hot|fire|temp|burn|overheat|forge|warm|vuur)/i,
  desync: /\b(desync|drift|sync|out of step)/i,
  portal: /\b(portal|rift|flicker|vault|tear|gate)/i,
  signal: /\b(signal|sensor|echo|relay|latency|network|antenna|duplicate)/i,
  other: /$^/,
};

export function typeByRules(text: string): GlitchType {
  return GLITCH_TYPES.find((t) => TYPE_WORDS[t].test(text)) ?? "other";
}

const RESOLVED =
  /\b(back to normal|resolved|fixed|all clear|stable again|gone now|no longer|opgelost|weer normaal)\b/i;
const NOISE = /^(.)\1+$|^(test|asdf|lol|xxx|hello|hi)\b/i;

function words(text: string) {
  return new Set(text.toLowerCase().match(/[a-z]{4,}/g) ?? []);
}

/** Share of words two texts have in common (Jaccard), 0..1. */
function similarity(a: string, b: string) {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return common / (wa.size + wb.size - common);
}

function triageWithRules(
  text: string,
  target: Candidate | null,
  list: Candidate[],
  team: Defender[],
): Omit<Triage, "source"> {
  const letters = (text.match(/[a-z]/gi) ?? []).length;
  if (letters < 6 || NOISE.test(text.trim())) {
    return {
      accept: false,
      rejectReason: "too short or not a real report",
      glitchType: "other",
      duplicateOf: null,
      resolves: false,
      assignTo: null,
      reason: "moderation rule",
    };
  }
  const glitchType = typeByRules(text);
  if (target) {
    const resolves = RESOLVED.test(text);
    return {
      accept: true,
      rejectReason: "",
      glitchType,
      duplicateOf: null,
      resolves,
      assignTo: null,
      reason: resolves
        ? "update says the problem is resolved"
        : "update on the glitch",
    };
  }
  const best = list
    .map((g) => ({ g, score: similarity(text, g.description) }))
    .sort((a, b) => b.score - a.score)[0];
  if (best && best.score >= 0.45) {
    return {
      accept: true,
      rejectReason: "",
      glitchType: best.g.type ?? glitchType,
      duplicateOf: best.g.glitchId,
      resolves: false,
      assignTo: null,
      reason: `${Math.round(best.score * 100)}% of the words match ${best.g.glitchId}`,
    };
  }
  const pick = [...team].sort(
    (a, b) =>
      (b.experience[glitchType] ?? 0) - (a.experience[glitchType] ?? 0) ||
      a.openAssignments - b.openAssignments,
  )[0];
  return {
    accept: true,
    rejectReason: "",
    glitchType,
    duplicateOf: null,
    resolves: false,
    assignTo: pick?.guardianId ?? null,
    reason: pick
      ? `${pick.codename} has the most ${glitchType} experience and room for it`
      : "new glitch",
  };
}

// ---------- public ----------

/** Triage one echo. `targetGlitchId` set = an update on that glitch; unset = a new sighting. */
export async function triageEcho(
  text: string,
  targetGlitchId?: string,
  /** skip the AI and use the rules (saves AI quota for background work) */
  rulesOnly = false,
): Promise<Triage> {
  const list = candidates();
  const team = defenders();
  const target = targetGlitchId
    ? (list.find((g) => g.glitchId === targetGlitchId) ??
      (() => {
        const g = db
          .select()
          .from(glitches)
          .where(eq(glitches.glitchId, targetGlitchId))
          .get();
        return g
          ? {
              glitchId: g.glitchId,
              status: g.status,
              type: g.glitchType ?? null,
              description: g.description,
              timestamp: g.timestamp,
            }
          : null;
      })())
    : null;

  // Claude gets the 30 glitches that look most like this echo (plenty to spot a duplicate, small prompt).
  const shortlist = [...list].sort((a, b) => similarity(text, b.description) - similarity(text, a.description)).slice(0, 30);
  const ai = rulesOnly ? null : await triageWithClaude(text, target, shortlist, team);
  if (ai) {
    // Only trust ids that really exist.
    const duplicateOf =
      !target &&
      ai.duplicate_of &&
      list.some((g) => g.glitchId === ai.duplicate_of)
        ? ai.duplicate_of
        : null;
    const assignTo =
      ai.assign_to && team.some((d) => d.guardianId === ai.assign_to)
        ? ai.assign_to
        : null;
    return {
      source: "ai",
      accept: ai.accept,
      rejectReason: ai.reject_reason,
      glitchType: ai.glitch_type,
      duplicateOf,
      resolves: Boolean(target) && ai.resolves_glitch,
      assignTo: duplicateOf || target ? null : assignTo,
      reason: ai.reason,
    };
  }
  return { source: "rules", ...triageWithRules(text, target, list, team) };
}

/** Write one line to a glitch's AI history. */
export function addAiNote(
  glitchId: string,
  action: AiAction,
  message: string,
  source: Source,
) {
  db.insert(aiNotes)
    .values({
      glitchId,
      action,
      message,
      source,
      timestamp: new Date().toISOString(),
    })
    .run();
}

export function codenameOf(guardianId: string) {
  return (
    db
      .select()
      .from(guardians)
      .where(eq(guardians.guardianId, guardianId))
      .get()?.codename ?? guardianId
  );
}

/**
 * For glitches the system opened itself (predictive analysis from anomalies): let the AI pick the
 * type and a defender afterwards. Never groups or closes these; only types and assigns.
 */
export async function enrichNewGlitch(glitchId: string) {
  const glitch = db.select().from(glitches).where(eq(glitches.glitchId, glitchId)).get()
  if (!glitch) return
  // System glitches appear about once a minute; with a free-tier AI key that would use up the daily
  // quota. So they use the rules unless AI_SYSTEM_GLITCHES=on is set in .env.
  const useAi = (process.env.AI_SYSTEM_GLITCHES || '').toLowerCase() === 'on'
  const triage = await triageEcho(glitch.description, undefined, !useAi)
  const by = triage.source === 'ai' ? 'AI' : 'Rules'
  const assignTo = glitch.assignedGuardianId ?? triage.assignTo
  db.update(glitches).set({ glitchType: triage.glitchType, assignedGuardianId: assignTo }).where(eq(glitches.glitchId, glitchId)).run()
  addAiNote(glitchId, 'typed', `${by} sorted this system-detected glitch as ${triage.glitchType}`, triage.source)
  if (!glitch.assignedGuardianId && triage.assignTo) {
    addAiNote(glitchId, 'assigned', `${by} assigned it to ${codenameOf(triage.assignTo)}: ${triage.reason}`, triage.source)
  }
}
