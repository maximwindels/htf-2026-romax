/**
 * Predictive glitches: critical anomalies open a glitch in the guardians' glitch list by themselves
 * (status LEAKED), so the base assignment's glitch list and the live telemetry are one workflow.
 *
 * - All critical anomalies of one tick become ONE glitch (a Desync wave = one glitch, not five).
 * - Per node + metric at most one auto-glitch per COOLDOWN_MS, so a long incident doesn't flood the list,
 *   and none at all while an earlier one for it is still open (lib/autoGlitches.server.ts closes it
 *   once its alerts are cleared).
 */
import { eq } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { glitches, nodes } from '#/db/schema.ts'
import type { Glitch } from '#/lib/glitch.ts'
import { incidentsWithOpenGlitch, sourceKey } from '#/lib/autoGlitches.server.ts'
import { nextId } from '#/lib/ids.server.ts'
import { METRIC_INFO, type Anomaly } from '#/lib/grid.ts'
import { enrichNewGlitch, typeByRules } from '#/server/ai/triage.ts'
import { bus } from './bus'
import { seriesKey } from './helpers'

const COOLDOWN_MS = 120_000
const lastGlitchAt = new Map<string, number>()

export function openGlitchFor(critical: Anomaly[], ts: Date) {
  // Skip incidents that already have an open auto-glitch: no pile-up on LEAKED for the same trouble.
  const covered = incidentsWithOpenGlitch()
  const fresh = critical.filter(
    (a) =>
      !covered.has(sourceKey(a.nodeId, a.metric)) &&
      ts.getTime() - (lastGlitchAt.get(seriesKey(a.nodeId, a.metric)) ?? 0) > COOLDOWN_MS,
  )
  if (fresh.length === 0) return
  for (const a of fresh) lastGlitchAt.set(seriesKey(a.nodeId, a.metric), ts.getTime())

  const description = describe(fresh)
  // Which incidents opened it, so it can be closed once they are cleared (lib/autoGlitches.server.ts).
  const source = [...new Set(fresh.map((a) => sourceKey(a.nodeId, a.metric)))].join(';')
  // Same id scheme as echoes reported by guardians (GL-0143), in one transaction.
  const glitch = db.transaction((tx): Glitch => {
    const row: Glitch = { glitchId: nextId(tx, 'GL'), status: 'LEAKED', description, timestamp: ts.toISOString(), glitchType: typeByRules(description) }
    tx.insert(glitches).values({ ...row, source }).run()
    return row
  })
  bus.emit('glitch', glitch)
  // AI picks the type and a defender in the background (rules when there is no AI key).
  void enrichNewGlitch(glitch.glitchId).then(() => {
    const updated = db.select().from(glitches).where(eq(glitches.glitchId, glitch.glitchId)).get()
    if (updated) bus.emit('glitch', updated)
  })
}

/** "Desync wave: Sync drift critical on Ember Forge, Tide Gate" or "Core temp critical on Ember Forge (91.2)". */
function describe(found: Anomaly[]): string {
  const names = new Map(db.select().from(nodes).all().map((n) => [n.id, n.name]))
  const nodeNames = [...new Set(found.map((a) => names.get(a.nodeId) ?? a.nodeId))]
  const metrics = [...new Set(found.map((a) => METRIC_INFO[a.metric].label))]
  if (nodeNames.length > 1) return `Desync wave: ${metrics.join(' + ')} critical on ${nodeNames.join(', ')} [auto]`
  const a = found[0]
  return `${METRIC_INFO[a.metric].label} critical on ${nodeNames[0]} (${a.value.toFixed(1)}): ${a.message} [auto]`
}
