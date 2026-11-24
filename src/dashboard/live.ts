/**
 * Live updates: one Server-Sent Events connection that writes every event straight into the
 * TanStack Query cache. Components keep using their normal queries and re-render when the cache changes.
 */
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  METRICS,
  type Anomaly,
  type EarlyWarning,
  type Latest,
  type Metric,
  type SeriesPoint,
  type Tick,
  type TroubleMode,
} from '#/lib/grid.ts';
import type { DesyncModifiers } from '#/lib/games.ts';
import { notify, notifyWarning } from './alerts';
import { gamesQk } from './games';
import { SERIES_MINUTES, qk } from './api';

export type LiveStatus = 'connecting' | 'live' | 'offline';

const MAX_AGE_MS = SERIES_MINUTES * 60_000;
const MAX_ANOMALIES = 500;
const MAX_WARNINGS = 100;

export function useLiveStream(): LiveStatus {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [status, setStatus] = useState<LiveStatus>('connecting');

  useEffect(() => {
    const events = new EventSource('/api/stream');
    const on = <T,>(event: string, handle: (data: T) => void) =>
      events.addEventListener(event, (e) => handle(JSON.parse((e as MessageEvent).data)));

    events.onopen = () => {
      setStatus('live');
      // After a (re)connect, refill any gap from the database.
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: qk.anomalies });
    };
    events.onerror = () => setStatus('offline'); // EventSource reconnects by itself

    on<Tick>('tick', (tick) => applyTick(queryClient, tick));
    on<Anomaly>('anomaly', (anomaly) => {
      prepend(queryClient, qk.anomalies, anomaly, MAX_ANOMALIES);
      notify(anomaly);
    });
    on<Anomaly>('ack', (anomaly) => replace(queryClient, qk.anomalies, anomaly));
    on<EarlyWarning>('warning', (warning) => {
      prepend(queryClient, qk.warnings, warning, MAX_WARNINGS);
      notifyWarning(warning);
    });
    on<EarlyWarning>('warning-confirmed', (warning) => replace(queryClient, qk.warnings, warning));
    // A glitch was opened automatically: reload the route loaders, so the glitch list shows it.
    on('glitch', () => router.invalidate());
    // A commander switched calm / normal / chaos: every dashboard shows the new mode.
    on<TroubleMode>('mode', (mode) => queryClient.setQueryData(qk.simMode, { mode }));
    // Mini-game results: immunity / backlash for the corruption, and the leaderboard.
    on<DesyncModifiers>('modifiers', (mods) => queryClient.setQueryData(gamesQk.modifiers, mods));
    on('run', () => queryClient.invalidateQueries({ queryKey: gamesQk.leaderboard }));
    // Testing "clear all": too many rows to patch one by one, so refetch the lists.
    on('cleared', () => {
      queryClient.invalidateQueries({ queryKey: qk.anomalies });
      queryClient.invalidateQueries({ queryKey: qk.stats });
      queryClient.invalidateQueries({ queryKey: qk.forecasts });
    });

    return () => events.close();
  }, [queryClient, router]);

  return status;
}

// ---------- cache updates ----------

/** Add a new item at the top of a cached list (and refresh the KPI stats). */
function prepend<T>(qc: QueryClient, key: readonly unknown[], item: T, max: number) {
  qc.setQueryData<T[]>(key, (old) => (old ? [item, ...old].slice(0, max) : old));
  qc.invalidateQueries({ queryKey: qk.stats });
}

/** Swap an updated item (same id) into a cached list (and refresh the KPI stats). */
function replace<T extends { id: number }>(qc: QueryClient, key: readonly unknown[], item: T) {
  qc.setQueryData<T[]>(key, (old) => old?.map((x) => (x.id === item.id ? item : x)));
  qc.invalidateQueries({ queryKey: qk.stats });
}

/** One tick: new forecasts, new latest values, and one new point on every chart that is open. */
function applyTick(qc: QueryClient, tick: Tick) {
  qc.setQueryData(qk.forecasts, tick.forecasts);

  qc.setQueryData<Latest>(qk.latest, (old) => {
    const latest: Latest = { ...old };
    for (const r of tick.readings) latest[r.nodeId] = { ...latest[r.nodeId], [r.metric]: r.value };
    return latest;
  });

  // Series queries are keyed ['series', metric, 'all' | nodeId].
  for (const query of qc.getQueryCache().findAll({ queryKey: ['series'] })) {
    const [, metric, scope] = query.queryKey as [string, Metric, string];
    if (!METRICS.includes(metric)) continue;
    const point = newPoint(tick, metric, scope);
    if (!point) continue;
    qc.setQueryData<SeriesPoint[]>(query.queryKey, (old) => {
      if (!old) return old;
      const recent = old.filter((p) => p.t > tick.ts - MAX_AGE_MS); // keep the chart window fixed
      return [...recent, point];
    });
  }
}

/** The chart point for this tick: the all-nodes summary, or one node's value. */
function newPoint(tick: Tick, metric: Metric, scope: string): SeriesPoint | undefined {
  if (scope === 'all') return { t: tick.ts, ...tick.summary[metric] };
  const reading = tick.readings.find((r) => r.nodeId === scope && r.metric === metric);
  return reading && { t: tick.ts, avg: reading.value, min: reading.value, max: reading.value };
}
