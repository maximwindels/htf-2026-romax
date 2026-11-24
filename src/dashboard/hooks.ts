import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { Glitch } from '#/lib/glitch.ts';
import { getGlitches } from '#/lib/glitches.functions.ts';
import { SEVERITY_RANK, type Anomaly, type Metric, type Severity } from '#/lib/grid.ts';
import { api, qk } from './api';

// Live data is pushed by SSE into the cache, so these never need to refetch on their own.
const live = { staleTime: Infinity, refetchOnWindowFocus: false } as const;

export const useNodes = () => useQuery({ queryKey: qk.nodes, queryFn: api.nodes, staleTime: Infinity });
export const useLatest = () => useQuery({ queryKey: qk.latest, queryFn: api.latest, ...live });
export const useAnomalies = () => useQuery({ queryKey: qk.anomalies, queryFn: api.anomalies, ...live });
export const useStats = () => useQuery({ queryKey: qk.stats, queryFn: api.stats, refetchInterval: 10_000 });
export const useForecasts = () => useQuery({ queryKey: qk.forecasts, queryFn: api.forecasts, ...live });
export const useWarnings = () => useQuery({ queryKey: qk.warnings, queryFn: api.warnings, ...live });
export const useSeries = (metric: Metric, nodeId?: string) =>
  useQuery({ queryKey: qk.series(metric, nodeId), queryFn: () => api.series(metric, nodeId), ...live });

/** The glitch list (server function from the starter). The route loader gives the first data; SSE `glitch` events add new ones. */
export const useGlitches = (initialData: Glitch[]) =>
  useQuery({ queryKey: qk.glitches, queryFn: () => getGlitches(), initialData, ...live });

export function useAck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.ack,
    onSuccess: (row) => {
      qc.setQueryData<Anomaly[]>(qk.anomalies, (old) => old?.map((a) => (a.id === row.id ? row : a)));
      qc.invalidateQueries({ queryKey: qk.stats });
    },
  });
}

/** Re-render every `ms` so "time ago" labels and status windows stay fresh. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export type NodeStatus = 'ok' | Severity;
const STATUS_WINDOW_MS = 2 * 60_000;

/** Worst open anomaly per node in the last 2 minutes. */
export function useNodeStatuses(): Record<string, NodeStatus> {
  const { data: anomalies = [] } = useAnomalies();
  const now = useNow(2000);
  return useMemo(() => {
    const out: Record<string, NodeStatus> = {};
    for (const a of anomalies) {
      if (a.acknowledgedAt || now - Date.parse(a.ts) > STATUS_WINDOW_MS) continue;
      const cur = out[a.nodeId];
      if (!cur || cur === 'ok' || SEVERITY_RANK[a.severity] > SEVERITY_RANK[cur]) out[a.nodeId] = a.severity;
    }
    return out;
  }, [anomalies, now]);
}
