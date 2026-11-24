import { useMemo, useSyncExternalStore } from 'react';
import { backlashAt } from '#/lib/games.ts';
import { useDesyncModifiers } from './games';
import { useAnomalies, useNow } from './hooks';

/**
 * The Desync gets into the app itself. The more open errors, the higher the level and the more
 * corrupted the UI looks (styled in grid.css through <html data-desync="0-3">):
 *   0 Stable     no open errors          clean
 *   1 Unstable   1-2 errors              RGB split on headings and readouts
 *   2 Corrupted  3-5 errors              + trembling buttons, KPI values turn into 0x4F_CORRUPT
 *   3 Desync     6 or more               + cards slip, scanlines roll over the screen
 * "Errors" are open incidents (one node + metric), not raw alerts: a glitch fires an alert every
 * second it lasts. Critical incidents count double.
 */
export type DesyncLevel = 0 | 1 | 2 | 3;

export const DESYNC_LEVELS: Record<DesyncLevel, { name: string; from: number }> = {
  0: { name: 'Stable', from: 0 },
  1: { name: 'Unstable', from: 1 },
  2: { name: 'Corrupted', from: 3 },
  3: { name: 'Desync', from: 6 },
};

/** Incidents whose last alert is older than this no longer count (stale, nobody is looking). */
const ERROR_WINDOW_MS = 5 * 60_000;
/** Each error point drains this much magic. */
const MAGIC_PER_ERROR = 12;

export interface DesyncState {
  /** Weighted open errors: incidents, criticals count double. */
  errors: number;
  level: DesyncLevel;
  /** Magic stability in % (100 = no errors), for the meter and the hum. */
  magic: number;
  /** Corruption per error after Desync Immunity (1 = none, 0.5 = best). */
  multiplier: number;
  /** Corruption % still left from failed mini-games (fades out). */
  backlash: number;
  /** How many backlashes are active (to notice a new one). */
  backlashCount: number;
}

export function levelFor(errors: number): DesyncLevel {
  if (errors >= DESYNC_LEVELS[3].from) return 3;
  if (errors >= DESYNC_LEVELS[2].from) return 2;
  if (errors >= DESYNC_LEVELS[1].from) return 1;
  return 0;
}

/**
 * Open errors -> level and magic. Mini-game results shift it (lib/games.ts):
 * Desync Immunity scales the corruption per error down, a backlash adds corruption on top.
 */
export function useDesync(): DesyncState {
  const { data: anomalies = [] } = useAnomalies();
  const mods = useDesyncModifiers();
  const now = useNow(2000);

  return useMemo(() => {
    // Worst open severity per incident (node + metric) in the window.
    const incidents = new Map<string, boolean>(); // key -> is critical
    for (const a of anomalies) {
      if (a.acknowledgedAt || now - Date.parse(a.ts) > ERROR_WINDOW_MS) continue;
      const key = `${a.nodeId}/${a.metric}`;
      incidents.set(key, incidents.get(key) || a.severity === 'critical');
    }
    let errors = 0;
    for (const critical of incidents.values()) errors += critical ? 2 : 1;

    const backlash = backlashAt(mods, now);
    // Effective error points: immunity makes each error weigh less, backlash weighs in on its own.
    const effective = errors * mods.multiplier + backlash / MAGIC_PER_ERROR;
    return {
      errors,
      level: levelFor(effective),
      magic: Math.round(Math.max(0, 100 - effective * MAGIC_PER_ERROR)),
      multiplier: mods.multiplier,
      backlash: Math.round(backlash),
      backlashCount: mods.backlash.length,
    };
  }, [anomalies, mods, now]);
}

// Small store so any component (e.g. a KPI value) can read the level without prop drilling.
let level: DesyncLevel = 0;
const listeners = new Set<() => void>();

export function setDesyncLevel(next: DesyncLevel) {
  if (next === level) return;
  level = next;
  listeners.forEach((l) => l());
}

export function useDesyncLevel(): DesyncLevel {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => level,
    () => 0,
  );
}
