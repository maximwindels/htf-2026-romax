/** Read and write queries behind the /api routes (src/routes/api). Each one is a thin layer over Drizzle. */
import { and, count, desc, eq, gt, isNull, max, sql } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { anomalies, earlyWarnings, nodes, readings } from '#/db/schema.ts'
import type { Anomaly, EarlyWarning, GridNode, Latest, Metric, SeriesPoint, Stats } from '#/lib/grid.ts'
import { bus } from './bus'

const minutesAgo = (minutes: number) => Date.now() - minutes * 60_000
const isoMinutesAgo = (minutes: number) => new Date(minutesAgo(minutes)).toISOString()

export function listNodes(): GridNode[] {
  return db.select().from(nodes).orderBy(nodes.name).all()
}

/** Latest value per node per metric, as { nodeId: { metric: value } }. All readings of one tick share a ts. */
export function latestValues(): Latest {
  const newest = db.select({ ts: max(readings.ts) }).from(readings).where(gt(readings.ts, Date.now() - 30_000)).get()
  const latest: Latest = {}
  if (!newest?.ts) return latest
  for (const row of db.select().from(readings).where(eq(readings.ts, newest.ts)).all()) {
    latest[row.nodeId] ??= {}
    latest[row.nodeId][row.metric] = row.value
  }
  return latest
}

/** Time series for a chart: one point (avg, min, max) per tick, for all nodes or one node. */
export function series(metric: Metric, minutes: number, nodeId?: string): SeriesPoint[] {
  return db
    .select({
      t: readings.ts,
      avg: sql<number>`avg(${readings.value})`,
      min: sql<number>`min(${readings.value})`,
      max: sql<number>`max(${readings.value})`,
    })
    .from(readings)
    .where(
      and(
        eq(readings.metric, metric),
        gt(readings.ts, minutesAgo(minutes)),
        nodeId ? eq(readings.nodeId, nodeId) : undefined,
      ),
    )
    .groupBy(readings.ts)
    .orderBy(readings.ts)
    .all()
}

export function listAnomalies(limit: number, onlyOpen: boolean): Anomaly[] {
  return db
    .select()
    .from(anomalies)
    .where(onlyOpen ? isNull(anomalies.acknowledgedAt) : undefined)
    .orderBy(desc(anomalies.ts), desc(anomalies.id))
    .limit(limit)
    .all()
}

/**
 * Acknowledge every open anomaly of one node + metric: one glitch fires an anomaly per tick, so a
 * stabilized critical clears the whole incident, not one tick of it. Each row emits an `ack` event.
 */
export function acknowledgeIncident(nodeId: string, metric: Metric): Anomaly[] {
  const rows = db
    .update(anomalies)
    .set({ acknowledgedAt: new Date().toISOString() })
    .where(and(eq(anomalies.nodeId, nodeId), eq(anomalies.metric, metric), isNull(anomalies.acknowledgedAt)))
    .returning()
    .all()
  for (const row of rows) bus.emit('ack', row)
  return rows
}

/** Testing only: acknowledge every open anomaly at once. Emits one `cleared` event, not one per row. */
export function acknowledgeAllOpen(): number {
  const rows = db
    .update(anomalies)
    .set({ acknowledgedAt: new Date().toISOString() })
    .where(isNull(anomalies.acknowledgedAt))
    .returning({ id: anomalies.id })
    .all()
  bus.emit('cleared', { count: rows.length })
  return rows.length
}

export function getAnomaly(id: number): Anomaly | undefined {
  return db.select().from(anomalies).where(eq(anomalies.id, id)).get()
}

/** Acknowledge an anomaly and tell every other open dashboard. Returns undefined when the id is unknown. */
export function acknowledge(id: number): Anomaly | undefined {
  const anomaly = db
    .update(anomalies)
    .set({ acknowledgedAt: sql`coalesce(${anomalies.acknowledgedAt}, ${new Date().toISOString()})` })
    .where(eq(anomalies.id, id))
    .returning()
    .get()
  if (anomaly) bus.emit('ack', anomaly)
  return anomaly
}

export function listWarnings(limit: number): EarlyWarning[] {
  return db.select().from(earlyWarnings).orderBy(desc(earlyWarnings.ts), desc(earlyWarnings.id)).limit(limit).all()
}

/** Numbers for the KPI cards. */
export function stats(): Stats {
  const openBySeverity = db
    .select({ severity: anomalies.severity, count: count() })
    .from(anomalies)
    .where(isNull(anomalies.acknowledgedAt))
    .groupBy(anomalies.severity)
    .all()
  const anomaliesLastHour = db.select({ count: count() }).from(anomalies).where(gt(anomalies.ts, isoMinutesAgo(60))).get()
  const readingsLastMinute = db.select({ count: count() }).from(readings).where(gt(readings.ts, minutesAgo(1))).get()
  const warnings = db
    .select({
      total: count(),
      confirmed: count(earlyWarnings.confirmedAt),
      avgLead: sql<number | null>`avg(${earlyWarnings.leadSeconds})`,
    })
    .from(earlyWarnings)
    .where(gt(earlyWarnings.ts, isoMinutesAgo(60)))
    .get()

  const result: Stats = {
    openBySeverity: { medium: 0, high: 0, critical: 0 },
    lastHour: anomaliesLastHour?.count ?? 0,
    readingsPerMinute: readingsLastMinute?.count ?? 0,
    warningsLastHour: warnings?.total ?? 0,
    confirmedLastHour: warnings?.confirmed ?? 0,
    avgLeadSeconds: warnings?.avgLead ?? null,
  }
  for (const row of openBySeverity) result.openBySeverity[row.severity] = row.count
  return result
}
