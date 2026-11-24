import type { Metric } from '#/lib/grid.ts';

/** One key per node + metric, used by every per-series map ("ember-forge:temperature"). */
export function seriesKey(nodeId: string, metric: Metric): string {
  return `${nodeId}:${metric}`;
}

export function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function standardDeviation(values: number[], mean = average(values)): number {
  const variance = average(values.map((v) => (v - mean) ** 2));
  return Math.sqrt(variance);
}

export function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Random integer from min to max, both included. */
export function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Normally distributed noise (mean 0, std 1), Box-Muller method. */
export function gaussianNoise(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
