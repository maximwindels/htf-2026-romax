/**
 * Predictive glitches: critical anomalies open a glitch in the guardians' glitch list by themselves
 * (status LEAKED), so the base assignment's glitch list and the live telemetry are one workflow.
 *
 * - All critical anomalies of one tick become ONE glitch (a Desync wave = one glitch, not five).
 * - Per node + metric at most one auto-glitch per COOLDOWN_MS, so a long incident doesn't flood the list.
 */
import { desc, like } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { glitches, nodes } from '#/db/schema.ts'
import type { Glitch } from '#/lib/glitch.ts'
import { METRIC_INFO, type Anomaly } from '#/lib/grid.ts'
import { bus } from './bus'
import { seriesKey } from './helpers'

const COOLDOWN_MS = 120_000
const lastGlitchAt = new Map<string, number>()

export function openGlitchFor(critical: Anomaly[], ts: Date) {
  const fresh = critical.filter((a) => ts.getTime() - (lastGlitchAt.get(seriesKey(a.nodeId, a.metric)) ?? 0) > COOLDOWN_MS)
  if (fresh.length === 0) return
  for (const a of fresh) lastGlitchAt.set(seriesKey(a.nodeId, a.metric), ts.getTime())

  const glitch: Glitch = {
    glitchId: nextGlitchId(),
    status: 'LEAKED',
    description: describe(fresh),
    timestamp: ts.toISOString(),
  }
  db.insert(glitches).values(glitch).run()
  bus.emit('glitch', glitch)
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

/** GL-0142 -> GL-0143. Ids are zero-padded, so text order is number order. */
function nextGlitchId(): string {
  const last = db.select({ id: glitches.glitchId }).from(glitches).where(like(glitches.glitchId, 'GL-%')).orderBy(desc(glitches.glitchId)).get()
  const next = (last ? Number(last.id.slice(3)) : 0) + 1
  return `GL-${String(next).padStart(4, '0')}`
}
