// Server-only: the link between auto-glitches (opened by critical alerts, see server/grid/autoGlitch.ts)
// and the alerts behind them, so they don't pile up on LEAKED:
// - no second auto-glitch while one is still open for the same node + metric
// - an auto-glitch is set to FIXED once every alert behind it has been cleared (acknowledged / stabilized)
import { and, eq, isNull, like, ne, or, isNotNull } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { anomalies, echoes, glitches } from '#/db/schema.ts'
import { announce, logEvent } from '#/lib/glitches.server.ts'
import type { Guardian } from '#/lib/guardian.ts'
import { nextId } from '#/lib/ids.server.ts'

/** "nodeId/metric": one incident. An auto-glitch's `source` is a ";"-joined list of these. */
export const sourceKey = (nodeId: string, metric: string) => `${nodeId}/${metric}`

const parseSource = (source: string | null) => (source ? source.split(';').filter(Boolean) : [])

/** Open (not FIXED) auto-glitches: new ones carry `source`; older ones only the "[auto]" marker. */
function openAutoGlitches() {
  return db
    .select()
    .from(glitches)
    .where(
      and(ne(glitches.status, 'FIXED'), or(isNotNull(glitches.source), like(glitches.description, '%[auto]'))),
    )
    .all()
}

/** Incidents that already have an open auto-glitch: the auto-glitch opener skips these. */
export function incidentsWithOpenGlitch(): Set<string> {
  return new Set(openAutoGlitches().flatMap((g) => parseSource(g.source)))
}

function hasOpenAlerts(key: string) {
  const [nodeId, metric] = key.split('/')
  return !!db
    .select({ id: anomalies.id })
    .from(anomalies)
    .where(and(eq(anomalies.nodeId, nodeId), eq(anomalies.metric, metric as never), isNull(anomalies.acknowledgedAt)))
    .get()
}

/**
 * Close auto-glitches whose alerts are all cleared, with a history line and an echo by `actor`.
 * `all`: close every open auto-glitch (the "Clear all errors" test button), also old ones
 * without a recorded source. Returns how many were closed.
 */
export function resolveAutoGlitches(actor: Guardian, { all = false }: { all?: boolean } = {}): number {
  const done = openAutoGlitches().filter((g) => {
    if (all) return true
    const keys = parseSource(g.source)
    return keys.length > 0 && keys.every((k) => !hasOpenAlerts(k))
  })
  for (const g of done) {
    db.transaction((tx) => {
      tx.update(glitches).set({ status: 'FIXED' }).where(eq(glitches.glitchId, g.glitchId)).run()
      logEvent(tx, actor, g.glitchId, 'status', g.status, 'FIXED')
      tx.insert(echoes)
        .values({
          echoId: nextId(tx, 'EC'),
          glitchId: g.glitchId,
          description: all
            ? 'Closed with "Clear all errors".'
            : 'The alerts behind this glitch were cleared, so it was closed automatically.',
          timestamp: new Date().toISOString(),
          reportingGuardianId: actor.guardianId,
        })
        .run()
    })
    announce(g.glitchId)
  }
  return done.length
}
