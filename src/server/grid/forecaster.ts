/**
 * Early warning: "spot anomalies early" from the brief.
 *
 * For each node + metric, draw a straight trend line through the last WINDOW readings
 * (least squares). If the line is clearly rising toward a hard limit, predict when it crosses it.
 *
 * A forecast is only raised when ALL of these are true:
 * - the line fits well (r² >= MIN_R2): a real trend, not noise
 * - it rises fast enough: at least MIN_SLOPE_FRACTION of the limit per second. Normal slow waves
 *   (at most ~0.7%/s of the limit, noise included) are ignored; real build-ups (1%/s and up) are caught
 * - the value has already left its normal band: at least MIN_Z standard deviations above the
 *   detector's baseline, so values still inside normal variation don't count
 * - the predicted crossing is within MAX_ETA seconds
 */
import { HARD_LIMITS, type Forecast, type Reading } from '#/lib/grid.ts';
import { baseline } from './detector';
import { seriesKey } from './helpers';

const WINDOW = 12;
const MIN_POINTS = 8;
const MIN_R2 = 0.75;
const MIN_SLOPE_FRACTION = 0.008;
const MIN_Z = 2;
const MAX_ETA = 120;
/** After a warning, the same series can't raise a NEW warning for this long (avoids repeats on flicker). */
const RESTART_COOLDOWN_MS = 60_000;

interface Point {
  seconds: number;
  value: number;
}

/** Recent points per series. */
const history = new Map<string, Point[]>();
/** Forecasts that are active right now, per series. */
const active = new Map<string, Forecast>();
/** When each series last raised a new warning. */
const lastStartedAt = new Map<string, number>();

/** Least-squares straight line through the points: slope, how well it fits (r²) and a way to read it. */
function fitLine(points: Point[]) {
  const start = points[0].seconds;
  const xs = points.map((p) => p.seconds - start);
  const ys = points.map((p) => p.value);
  const n = points.length;

  const sumX = xs.reduce((s, x) => s + x, 0);
  const sumY = ys.reduce((s, y) => s + y, 0);
  const sumXX = xs.reduce((s, x) => s + x * x, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  const valueAt = (seconds: number) => intercept + slope * (seconds - start);

  // r²: 1 = perfect line, 0 = no better than a flat average.
  const meanY = sumY / n;
  const totalVariation = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const unexplained = points.reduce((s, p) => s + (p.value - valueAt(p.seconds)) ** 2, 0);
  const r2 = totalVariation === 0 ? 0 : 1 - unexplained / totalVariation;

  return { slope, r2, valueAt };
}

/** A forecast for this reading if the trend is heading for the limit, otherwise null. */
function forecastFor(points: Point[], r: Reading, limit: number, ts: Date): Forecast | null {
  if (points.length < MIN_POINTS || r.value >= limit) return null;

  const line = fitLine(points);
  if (!line) return null;
  const fitsWell = line.r2 >= MIN_R2;
  const risesFastEnough = line.slope >= limit * MIN_SLOPE_FRACTION;

  const normal = baseline(r.nodeId, r.metric);
  const leftNormalBand = normal !== null && (r.value - normal.mean) / normal.std >= MIN_Z;

  if (!fitsWell || !risesFastEnough || !leftNormalBand) return null;

  const nowSeconds = ts.getTime() / 1000;
  const etaSeconds = (limit - line.valueAt(nowSeconds)) / line.slope;
  if (etaSeconds <= 0 || etaSeconds > MAX_ETA) return null;

  const previous = active.get(seriesKey(r.nodeId, r.metric));
  return {
    nodeId: r.nodeId,
    metric: r.metric,
    value: r.value,
    limit,
    slope: Number(line.slope.toFixed(3)),
    etaSeconds: Math.round(etaSeconds),
    confidence: Number(line.r2.toFixed(2)),
    since: previous?.since ?? ts.toISOString(),
  };
}

export function currentForecasts(): Forecast[] {
  return [...active.values()].sort((a, b) => a.etaSeconds - b.etaSeconds);
}

/** Feed one batch of readings. Returns all active forecasts and the ones that just started (new warnings). */
export function updateForecasts(readings: Reading[], ts: Date) {
  const started: Forecast[] = [];

  for (const r of readings) {
    const limit = HARD_LIMITS[r.metric]?.max;
    if (limit === undefined) continue;

    const key = seriesKey(r.nodeId, r.metric);
    const points = history.get(key) ?? [];
    points.push({ seconds: ts.getTime() / 1000, value: r.value });
    if (points.length > WINDOW) points.shift();
    history.set(key, points);

    const forecast = forecastFor(points, r, limit, ts);
    if (!forecast) {
      active.delete(key);
      continue;
    }

    const isNew = !active.has(key);
    const cooledDown = ts.getTime() - (lastStartedAt.get(key) ?? 0) > RESTART_COOLDOWN_MS;
    if (isNew && cooledDown) {
      lastStartedAt.set(key, ts.getTime());
      started.push(forecast);
    }
    active.set(key, forecast);
  }

  return { forecasts: currentForecasts(), started };
}
