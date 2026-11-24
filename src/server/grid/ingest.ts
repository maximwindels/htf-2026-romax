/**
 * The pipeline every batch of readings goes through, whatever the data source:
 *   1. forecast   - which trends are heading for a hard limit?
 *   2. broadcast  - push the tick (readings + summary + forecasts) to every browser
 *   3. store      - save the readings in the database
 *   4. warn       - save new forecasts as early warnings
 *   5. detect     - z-score + hard-limit check, save and broadcast anomalies
 *   6. glitch     - critical anomalies open a glitch in the guardians' glitch list
 *   7. confirm    - a warned limit was crossed: save how many seconds ahead we saw it
 */
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { anomalies, earlyWarnings, readings as readingsTable } from '#/db/schema.ts'
import {
  HARD_LIMITS,
  METRICS,
  type Anomaly,
  type EarlyWarning,
  type Forecast,
  type Metric,
  type Reading,
  type Summary,
} from '#/lib/grid.ts'
import { openGlitchFor } from './autoGlitch'
import { bus } from './bus'
import { detect } from './detector'
import { updateForecasts } from './forecaster'
import { average, seriesKey } from './helpers'

export async function ingest(readings: Reading[], ts = new Date()) {
  const { forecasts, started } = updateForecasts(readings, ts)
  bus.emit('tick', { ts: ts.getTime(), readings, summary: summarize(readings), forecasts })
  saveReadings(readings, ts)
  saveEarlyWarnings(started, ts)
  const found = detectAnomalies(readings, ts)
  openGlitchFor(found.filter((a) => a.severity === 'critical'), ts)
  confirmEarlyWarnings(readings, ts)
}

/** Average, min and max per metric across all nodes (for the overview charts). */
function summarize(readings: Reading[]): Record<Metric, Summary> {
  const summary = {} as Record<Metric, Summary>
  for (const metric of METRICS) {
    const values = readings.filter((r) => r.metric === metric).map((r) => r.value)
    summary[metric] = { avg: average(values), min: Math.min(...values), max: Math.max(...values) }
  }
  return summary
}

function saveReadings(readings: Reading[], ts: Date) {
  db.insert(readingsTable)
    .values(readings.map((r) => ({ ...r, ts: ts.getTime() })))
    .run()
}

// ---------- early warnings ----------

/** Warnings that have not been confirmed yet: series key -> time of the warning (ms). */
const openWarnings = new Map<string, number>()
/** A warning older than this can no longer be confirmed. */
const WARNING_TTL_MS = 180_000

function saveEarlyWarnings(started: Forecast[], ts: Date) {
  for (const f of started) {
    const warning = db
      .insert(earlyWarnings)
      .values({
        nodeId: f.nodeId,
        metric: f.metric,
        value: f.value,
        limitValue: f.limit,
        etaSeconds: f.etaSeconds,
        ts: ts.toISOString(),
      })
      .returning()
      .get() satisfies EarlyWarning
    bus.emit('warning', warning)
    openWarnings.set(seriesKey(f.nodeId, f.metric), ts.getTime())
  }
}

function confirmEarlyWarnings(readings: Reading[], ts: Date) {
  for (const r of readings) {
    const key = seriesKey(r.nodeId, r.metric)
    const warnedAt = openWarnings.get(key)
    const limit = HARD_LIMITS[r.metric]?.max
    const crossedLimit = limit !== undefined && r.value > limit
    if (warnedAt === undefined || !crossedLimit) continue

    openWarnings.delete(key)
    const tooOld = ts.getTime() - warnedAt > WARNING_TTL_MS
    if (tooOld) continue

    const pending = db
      .select()
      .from(earlyWarnings)
      .where(
        and(
          eq(earlyWarnings.nodeId, r.nodeId),
          eq(earlyWarnings.metric, r.metric),
          isNull(earlyWarnings.confirmedAt),
          gt(earlyWarnings.ts, new Date(ts.getTime() - WARNING_TTL_MS).toISOString()),
        ),
      )
      .all()

    for (const w of pending) {
      const leadSeconds = (ts.getTime() - Date.parse(w.ts)) / 1000
      const confirmed = db
        .update(earlyWarnings)
        .set({ confirmedAt: ts.toISOString(), leadSeconds })
        .where(eq(earlyWarnings.id, w.id))
        .returning()
        .get()
      bus.emit('warning-confirmed', confirmed)
    }
  }
}

// ---------- anomalies ----------

function detectAnomalies(readings: Reading[], ts: Date): Anomaly[] {
  const found: Anomaly[] = []
  for (const r of readings) {
    const detection = detect(r, ts)
    if (!detection) continue
    const anomaly = db
      .insert(anomalies)
      .values({ ...detection, ts: ts.toISOString() })
      .returning()
      .get() satisfies Anomaly
    bus.emit('anomaly', anomaly)
    found.push(anomaly)
  }
  return found
}
