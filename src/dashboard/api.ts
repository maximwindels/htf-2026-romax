import type { Anomaly, EarlyWarning, Forecast, GridNode, Latest, Metric, SeriesPoint, Stats } from '#/lib/grid.ts';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} - ${url}`);
  return res.json() as Promise<T>;
}

const post = <T>(url: string, body?: unknown) =>
  request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const SERIES_MINUTES = 5;

export const api = {
  nodes: () => request<GridNode[]>('/api/nodes'),
  latest: () => request<Latest>('/api/latest'),
  series: (metric: Metric, nodeId?: string) =>
    request<SeriesPoint[]>(
      `/api/series?metric=${metric}&minutes=${SERIES_MINUTES}${nodeId ? `&nodeId=${encodeURIComponent(nodeId)}` : ''}`,
    ),
  anomalies: () => request<Anomaly[]>('/api/anomalies?limit=500'),
  stats: () => request<Stats>('/api/stats'),
  ack: (id: number) => post<Anomaly>(`/api/anomalies/${id}/ack`),
  glitch: (body: { nodeId?: string; metric?: Metric } = {}) => post('/api/sim/glitch', body),
  desync: () => post('/api/sim/desync'),
  ramp: (body: { nodeId?: string; metric?: Metric } = {}) => post('/api/sim/ramp', body),
  forecasts: () => request<Forecast[]>('/api/forecasts'),
  warnings: () => request<EarlyWarning[]>('/api/warnings?limit=100'),
};

/** Query keys in one place so the SSE handler and the components agree. */
export const qk = {
  nodes: ['nodes'] as const,
  latest: ['latest'] as const,
  series: (metric: Metric, scope = 'all') => ['series', metric, scope] as const,
  anomalies: ['anomalies'] as const,
  stats: ['stats'] as const,
  forecasts: ['forecasts'] as const,
  warnings: ['warnings'] as const,
};
