import { createServerFn } from "@tanstack/react-start";
import { asc } from "drizzle-orm";
import { db } from "#/db/index.ts";
import {
  echoes,
  gameRuns,
  glitchEvents,
  glitches,
  guardians,
} from "#/db/schema.ts";
import { requireGuardian } from "#/lib/auth.server.ts";
import type { Guardian } from "#/lib/guardian.ts";

/** A guardian on the commander's roster, with what they have been doing. */
export type RosterEntry = Guardian & {
  /** glitches assigned to them that are not fixed yet */
  openAssigned: number;
  /** echoes (reports and updates) they sent */
  echoesSent: number;
  /** status changes they made */
  statusMoves: number;
  /** mini-games won */
  stabilized: number;
};

/** Commander only: every guardian with their workload and activity. */
export const getGuardianRoster = createServerFn({ method: "GET" }).handler(
  async (): Promise<RosterEntry[]> => {
    requireGuardian("commander");
    const people = db
      .select({
        guardianId: guardians.guardianId,
        codename: guardians.codename,
        role: guardians.role,
      })
      .from(guardians)
      .orderBy(asc(guardians.codename))
      .all();

    // Small tables: count in code, which keeps the queries simple to read.
    const assigned = db
      .select({ id: glitches.assignedGuardianId, status: glitches.status })
      .from(glitches)
      .all();
    const sent = db
      .select({ id: echoes.reportingGuardianId })
      .from(echoes)
      .all();
    const moves = db
      .select({ id: glitchEvents.guardianId, kind: glitchEvents.kind })
      .from(glitchEvents)
      .all();
    const runs = db
      .select({ id: gameRuns.guardianId, result: gameRuns.result })
      .from(gameRuns)
      .all();

    return people.map((g) => ({
      ...g,
      openAssigned: assigned.filter(
        (a) => a.id === g.guardianId && a.status !== "FIXED",
      ).length,
      echoesSent: sent.filter((e) => e.id === g.guardianId).length,
      statusMoves: moves.filter(
        (m) => m.id === g.guardianId && m.kind === "status",
      ).length,
      stabilized: runs.filter(
        (r) => r.id === g.guardianId && r.result === "win",
      ).length,
    }));
  },
);
