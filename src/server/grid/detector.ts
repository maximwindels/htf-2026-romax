/**
 * Anomaly detector: rolling z-score per node + metric, plus hard limits.
 *
 * z-score = how many standard deviations a value is away from its normal average.
 * - Warm-up: no alerts until WARMUP normal values are collected.
 * - Only normal values go into the window, so a glitch does not shift the baseline.
 * - Cooldown: at most one alert per node + metric per COOLDOWN_MS.
 * - Crossing a hard limit is always an anomaly, whatever the z-score.
 */
import { HARD_LIMITS, SEVERITY_RANK, type Metric, type Reading, type Severity } from '#/lib/grid.ts';
import { average, seriesKey, standardDeviation } from './helpers';

const WINDOW = 60;
const WARMUP = 20;
const COOLDOWN_MS = 15_000;
const Z_THRESHOLD = 4;

/** Recent normal values per series. */
const windows = new Map<string, number[]>();
/** Time of the last alert per series, for the cooldown. */
const lastAlertAt = new Map<string, number>();

export interface Detection {
  nodeId: string;
  metric: Metric;
  value: number;
  expected: number;
  zscore: number;
  severity: Severity;
  message: string;
  ts: Date;
}

/** Mean and std of a window. The std has a floor so a very flat signal doesn't alert on tiny wiggles. */
function stats(values: number[]) {
  const mean = average(values);
  const std = Math.max(standardDeviation(values, mean), Math.abs(mean) * 0.02, 0.1);
  return { mean, std };
}

/** Normal mean and std for one series, or null during warm-up. Also used by the forecaster. */
export function baseline(nodeId: string, metric: Metric): { mean: number; std: number } | null {
  const window = windows.get(seriesKey(nodeId, metric));
  if (!window || window.length < WARMUP) return null;
  return stats(window);
}

function severityFromZ(absZ: number): Severity {
  if (absZ >= 10) return 'critical';
  if (absZ >= 6) return 'high';
  return 'medium';
}

function worst(a: Severity, b: Severity): Severity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

export function detect(r: Reading, ts: Date): Detection | null {
  const key = seriesKey(r.nodeId, r.metric);
  const window = windows.get(key) ?? [];
  windows.set(key, window);

  if (window.length < WARMUP) {
    window.push(r.value);
    return null;
  }

  const { mean, std } = stats(window);
  const z = (r.value - mean) / std;
  const limit = HARD_LIMITS[r.metric];
  const overLimit = limit !== undefined && r.value > limit.max;
  const isAnomaly = Math.abs(z) >= Z_THRESHOLD || overLimit;

  if (!isAnomaly) {
    window.push(r.value);
    if (window.length > WINDOW) window.shift();
    return null;
  }

  const inCooldown = ts.getTime() - (lastAlertAt.get(key) ?? 0) < COOLDOWN_MS;
  if (inCooldown) return null;
  lastAlertAt.set(key, ts.getTime());

  const severity = overLimit ? worst(severityFromZ(Math.abs(z)), limit.severity) : severityFromZ(Math.abs(z));
  const message = overLimit
    ? `${r.metric} over hard limit ${limit.max} (${r.value.toFixed(1)})`
    : `${r.metric} ${z >= 0 ? 'spike' : 'drop'}: ${r.value.toFixed(1)} vs expected ${mean.toFixed(1)} (z=${z.toFixed(1)})`;

  return {
    nodeId: r.nodeId,
    metric: r.metric,
    value: r.value,
    expected: Number(mean.toFixed(2)),
    zscore: Number(z.toFixed(2)),
    severity,
    message,
    ts,
  };
}
