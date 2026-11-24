/**
 * Everything the High Council report shows, collected in one place.
 * Read-only: the same data the dashboard and the glitch list show, as a snapshot.
 */
import { count, desc, eq } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { assignee } from '#/lib/glitches.server.ts'
import { echoes, glitches } from '#/db/schema.ts'
import { GLITCH_STATUSES, type GlitchListItem, type GlitchStatus } from '#/lib/glitch.ts'
import { METRICS, SEVERITY_RANK, type Anomaly, type EarlyWarning, type GridNode, type Latest, type Metric, type SeriesPoint, type Severity, type Stats } from '#/lib/grid.ts'
import type { Guardian } from '#/lib/guardian.ts'
import { latestValues, listAnomalies, listNodes, listWarnings, series, stats } from '#/server/grid/queries.ts'

/** Same window as the dashboard: an open anomaly in the last 2 minutes degrades a node. */
const STATUS_WINDOW_MS = 2 * 60_000
/** The trend charts cover this many minutes. */
export const TREND_MINUTES = 30
/** At most this many points per trend line, so the PDF stays light. */
const TREND_POINTS = 90

export type NodeStatus = 'ok' | Severity

export interface ReportData {
  generatedAt: Date
  generatedBy: Guardian
  stats: Stats
  gridHealth: number
  nodes: (GridNode & { status: NodeStatus; latest: Latest[string] })[]
  glitches: GlitchListItem[]
  glitchesByStatus: Record<GlitchStatus, number>
  /** Most important first: open before acknowledged, then severity, then newest. */
  anomalies: Anomaly[]
  warnings: EarlyWarning[]
  trends: Record<Metric, SeriesPoint[]>
}

export function collectReportData(generatedBy: Guardian): ReportData {
  const now = Date.now()
  const allAnomalies = listAnomalies(500, false)

  const nodeStatus = (nodeId: string): NodeStatus => {
    let worst: NodeStatus = 'ok'
    for (const a of allAnomalies) {
      const recentAndOpen = !a.acknowledgedAt && now - Date.parse(a.ts) <= STATUS_WINDOW_MS
      if (a.nodeId !== nodeId || !recentAndOpen) continue
      if (worst === 'ok' || SEVERITY_RANK[a.severity] > SEVERITY_RANK[worst]) worst = a.severity
    }
    return worst
  }

  const latest = latestValues()
  const nodes = listNodes().map((n) => ({ ...n, status: nodeStatus(n.id), latest: latest[n.id] ?? {} }))
  const healthy = nodes.filter((n) => n.status === 'ok').length

  const glitchList = listGlitches()
  const glitchesByStatus = Object.fromEntries(GLITCH_STATUSES.map((s) => [s, 0])) as Record<GlitchStatus, number>
  for (const g of glitchList) glitchesByStatus[g.status]++

  return {
    generatedAt: new Date(now),
    generatedBy,
    stats: stats(),
    gridHealth: nodes.length ? Math.round((healthy / nodes.length) * 100) : 100,
    nodes,
    glitches: glitchList,
    glitchesByStatus,
    anomalies: mostImportant(allAnomalies).slice(0, 25),
    warnings: listWarnings(12),
    trends: Object.fromEntries(METRICS.map((m) => [m, downsample(series(m, TREND_MINUTES), TREND_POINTS)])) as Record<Metric, SeriesPoint[]>,
  }
}

/** The glitch list with echo counts (same query as the overview's glitch table). */
function listGlitches(): GlitchListItem[] {
  return db
    .select({
      glitchId: glitches.glitchId,
      status: glitches.status,
      description: glitches.description,
      timestamp: glitches.timestamp,
      echoCount: count(echoes.echoId),
      assigneeId: glitches.assignedGuardianId,
      assignee: assignee.codename,
    })
    .from(glitches)
    .leftJoin(echoes, eq(echoes.glitchId, glitches.glitchId))
    .leftJoin(assignee, eq(assignee.guardianId, glitches.assignedGuardianId))
    .groupBy(glitches.glitchId)
    .orderBy(desc(glitches.timestamp))
    .all()
}

function mostImportant(anomalies: Anomaly[]): Anomaly[] {
  return [...anomalies].sort(
    (a, b) =>
      Number(!!a.acknowledgedAt) - Number(!!b.acknowledgedAt) ||
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      b.ts.localeCompare(a.ts),
  )
}

/** Keep every n-th point (and the last one), so a long series becomes a short line. */
function downsample(points: SeriesPoint[], max: number): SeriesPoint[] {
  if (points.length <= max) return points
  const step = points.length / max
  const out = Array.from({ length: max - 1 }, (_, i) => points[Math.floor(i * step)])
  out.push(points[points.length - 1])
  return out
}
