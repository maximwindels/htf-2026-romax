// Server-only helpers for glitches.functions.ts. Kept out of that file so the client bundle
// (which keeps a *.functions.ts file's top-level code) never pulls in the database or the event bus.
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "#/db/index.ts";
import { glitchEvents, glitches, guardians } from "#/db/schema.ts";
import type { GlitchEventKind } from "#/lib/glitch.ts";
import type { Guardian } from "#/lib/guardian.ts";
import type { Tx } from "#/lib/ids.server.ts";
import { bus } from "#/server/grid/bus.ts";

/** The guardian a glitch is assigned to (a second join on the guardians table). */
export const assignee = alias(guardians, "assignee");

/** Tell every open dashboard that this glitch changed, so their glitch lists reload (SSE `glitch`). */
export function announce(glitchId: string) {
  const glitch = db
    .select()
    .from(glitches)
    .where(eq(glitches.glitchId, glitchId))
    .get();
  if (glitch) bus.emit("glitch", glitch);
}

/** Write one line of a glitch's history: a status change or a (re)assignment. */
export function logEvent(
  tx: Tx,
  actor: Guardian,
  glitchId: string,
  kind: GlitchEventKind,
  fromValue: string | null,
  toValue: string | null,
) {
  tx.insert(glitchEvents)
    .values({
      glitchId,
      kind,
      fromValue,
      toValue,
      guardianId: actor.guardianId,
      timestamp: new Date().toISOString(),
    })
    .run();
}
