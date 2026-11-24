import { METRIC_INFO, type Metric } from '#/lib/grid.ts';

export const fmt = (metric: Metric, v: number | undefined) =>
  v === undefined || Number.isNaN(v) ? '-' : v.toFixed(METRIC_INFO[metric].decimals);

export const fmtUnit = (metric: Metric, v: number | undefined) => `${fmt(metric, v)} ${METRIC_INFO[metric].unit}`;

export const fmtTime = (t: number | string) =>
  new Date(t).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function ago(ts: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(ts)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
