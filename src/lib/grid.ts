// Grid telemetry types, shared by the server (src/server/grid) and the dashboard (src/dashboard).
// When the real challenge data arrives, adapt these first: everything else follows.

export const METRICS = ['load', 'latency', 'temperature', 'drift'] as const;
export type Metric = (typeof METRICS)[number];

export const METRIC_INFO: Record<Metric, { label: string; unit: string; decimals: number }> = {
  load: { label: 'Mana load', unit: '%', decimals: 1 },
  latency: { label: 'Latency', unit: 'ms', decimals: 0 },
  temperature: { label: 'Core temp', unit: '°C', decimals: 1 },
  drift: { label: 'Sync drift', unit: 'ms', decimals: 1 },
};

/** How much random trouble the simulator makes by itself. Demo buttons work in every mode. */
export const TROUBLE_MODES = ['calm', 'normal', 'chaos'] as const;
export type TroubleMode = (typeof TROUBLE_MODES)[number];
export const TROUBLE_MODE_INFO: Record<TroubleMode, { label: string; hint: string }> = {
  calm: { label: 'Calm', hint: 'No random trouble: only what you trigger yourself' },
  normal: { label: 'Normal', hint: 'A random glitch every minute or two, now and then a Desync wave' },
  chaos: { label: 'Chaos', hint: 'Four times as much random trouble: The Desync is winning' },
};

export const SEVERITIES = ['medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];
export const SEVERITY_RANK: Record<Severity, number> = { medium: 1, high: 2, critical: 3 };

/** Hard limits: crossing one is always an anomaly. The forecaster predicts when a trend will cross one. */
export const HARD_LIMITS: Partial<Record<Metric, { max: number; severity: Severity }>> = {
  temperature: { max: 85, severity: 'critical' },
  latency: { max: 250, severity: 'critical' },
  drift: { max: 50, severity: 'critical' },
  load: { max: 97, severity: 'high' },
};

export interface GridNode {
  id: string;
  name: string;
  region: string;
  x: number;
  y: number;
}

export interface Reading {
  nodeId: string;
  metric: Metric;
  value: number;
}

export interface Summary {
  avg: number;
  min: number;
  max: number;
}

/** One simulator/ingest cycle, pushed to clients over SSE. */
export interface Tick {
  ts: number;
  readings: Reading[];
  summary: Record<Metric, Summary>;
  /** Trends that are heading for a hard limit right now. */
  forecasts: Forecast[];
}

/** Live prediction: "this metric will cross its limit in etaSeconds". Not stored per tick. */
export interface Forecast {
  nodeId: string;
  metric: Metric;
  value: number;
  limit: number;
  /** units per second, from a linear fit over the last readings */
  slope: number;
  etaSeconds: number;
  /** r² of the fit, 0..1 */
  confidence: number;
  /** ISO time the forecast first appeared */
  since: string;
}

/** Stored in the database when a forecast starts; confirmed when the real anomaly follows. */
export interface EarlyWarning {
  id: number;
  nodeId: string;
  metric: Metric;
  value: number;
  limitValue: number;
  etaSeconds: number;
  ts: string;
  confirmedAt: string | null;
  /** seconds between the warning and the anomaly it predicted */
  leadSeconds: number | null;
}

export interface SeriesPoint extends Summary {
  t: number;
}

/** Latest value per node per metric. */
export type Latest = Record<string, Partial<Record<Metric, number>>>;

export interface Anomaly {
  id: number;
  nodeId: string;
  metric: Metric;
  value: number;
  expected: number;
  zscore: number;
  severity: Severity;
  message: string;
  ts: string;
  acknowledgedAt: string | null;
}

export interface Stats {
  openBySeverity: Record<Severity, number>;
  lastHour: number;
  readingsPerMinute: number;
  warningsLastHour: number;
  confirmedLastHour: number;
  avgLeadSeconds: number | null;
}
