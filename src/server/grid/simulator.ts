/**
 * FAKE DATA SOURCE.
 * Makes one reading per node per metric every second, plus trouble on demand.
 * Tomorrow: replace `generateReadings()` with the real feed (their API, socket or database)
 * and keep calling `ingest()`. Nothing else has to change.
 */
import { METRICS, type Metric, type Reading, type TroubleMode } from '#/lib/grid.ts';
import { gaussianNoise, randomInt, randomItem } from './helpers';
import { ingest } from './ingest';
import { NODES } from './nodes';

// ---------- normal behaviour ----------

/** Normal signal per metric: base value + slow wave (amplitude, period in s) + random noise, clamped to min..max. */
const PROFILE: Record<Metric, { base: number; amp: number; period: number; noise: number; min: number; max: number }> = {
  load: { base: 55, amp: 5, period: 90, noise: 1.5, min: 0, max: 100 },
  latency: { base: 38, amp: 5, period: 70, noise: 2.5, min: 1, max: 2000 },
  temperature: { base: 58, amp: 3, period: 120, noise: 0.8, min: -20, max: 150 },
  drift: { base: 4, amp: 1, period: 50, noise: 0.4, min: 0, max: 1000 },
};

/** Each node gets its own level (factor) and wave offset (phase), so nodes don't look identical. */
const personality = new Map(
  NODES.map((n) => [n.id, { factor: 0.85 + Math.random() * 0.3, phase: Math.random() * Math.PI * 2 }]),
);

function normalValue(nodeId: string, metric: Metric, seconds: number): number {
  const { base, amp, period, noise } = PROFILE[metric];
  const { factor, phase } = personality.get(nodeId)!;
  const wave = amp * Math.sin((2 * Math.PI * seconds) / period + phase);
  return base * factor + wave + gaussianNoise() * noise;
}

// ---------- trouble: glitches, slow build-ups, Desync waves ----------

/**
 * A disturbance adds `delta` to one node's metric.
 * - Glitch: jumps to its full size at once, then stays for a few ticks.
 * - Build-up (ramp): grows a little every tick until it reaches `target`, then stays for a few ticks.
 *   Because it grows slowly, the forecaster can see it coming.
 */
interface Disturbance {
  nodeId: string;
  metric: Metric;
  delta: number;
  target: number;
  growPerTick: number;
  ticksAtTarget: number;
}
// Shared state lives on globalThis. In dev, a hot reload makes a fresh copy of this module while the
// running loop (started by runtime.ts) keeps the old one: with a module-level array, the demo buttons
// pushed into the new copy and the loop never saw them.
const g = globalThis as typeof globalThis & { __gridDisturbances?: Disturbance[]; __troubleMode?: TroubleMode };
const disturbances: Disturbance[] = (g.__gridDisturbances ??= []);

const GLITCH_SIZE: Record<Metric, () => number> = {
  load: () => (Math.random() < 0.5 ? -50 : 40),
  latency: () => 80 + Math.random() * 180,
  temperature: () => 22 + Math.random() * 15,
  drift: () => 25 + Math.random() * 60,
};
const RAMP_SIZE: Record<Metric, number> = { temperature: 40, latency: 260, drift: 60, load: 48 };
const RAMP_TICKS = 36;

/** Use the given node/metric if valid, otherwise pick a random one. */
function chooseTarget(nodeId?: string, metric?: Metric) {
  return {
    nodeId: nodeId && personality.has(nodeId) ? nodeId : randomItem(NODES).id,
    metric: metric && METRICS.includes(metric) ? metric : randomItem(METRICS),
  };
}

export function injectGlitch(nodeId?: string, metric?: Metric): Disturbance {
  const where = chooseTarget(nodeId, metric);
  const size = GLITCH_SIZE[where.metric]();
  const glitch = { ...where, delta: size, target: size, growPerTick: 0, ticksAtTarget: randomInt(3, 8) };
  disturbances.push(glitch);
  return glitch;
}

export function injectRamp(nodeId?: string, metric?: Metric): Disturbance {
  const where = chooseTarget(nodeId, metric);
  const size = RAMP_SIZE[where.metric];
  const ramp = { ...where, delta: 0, target: size, growPerTick: size / RAMP_TICKS, ticksAtTarget: 8 };
  disturbances.push(ramp);
  return ramp;
}

/** "The Desync": sync drift explodes on 3 to 5 random nodes at once. */
export function injectDesyncWave(): Disturbance[] {
  const shuffled = [...NODES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, randomInt(3, 5)).map((n) => injectGlitch(n.id, 'drift'));
}

function disturbanceFor(nodeId: string, metric: Metric): number {
  return disturbances
    .filter((d) => d.nodeId === nodeId && d.metric === metric)
    .reduce((sum, d) => sum + d.delta, 0);
}

/** Grow build-ups toward their target; count down the ones at target and remove them when done. */
function advanceDisturbances() {
  for (let i = disturbances.length - 1; i >= 0; i--) {
    const d = disturbances[i];
    if (d.delta < d.target) d.delta = Math.min(d.target, d.delta + d.growPerTick);
    else if (--d.ticksAtTarget <= 0) disturbances.splice(i, 1);
  }
}

// ---------- one tick ----------

function generateReadings(ts: Date): Reading[] {
  const seconds = ts.getTime() / 1000;
  const readings: Reading[] = [];
  for (const node of NODES) {
    for (const metric of METRICS) {
      const { min, max } = PROFILE[metric];
      const raw = normalValue(node.id, metric, seconds) + disturbanceFor(node.id, metric);
      const value = Math.min(max, Math.max(min, raw));
      readings.push({ nodeId: node.id, metric, value: Number(value.toFixed(2)) });
    }
  }
  advanceDisturbances();
  return readings;
}

/** Stops every running glitch, build-up and Desync wave at once (the "clear all" test button). */
export function clearDisturbances() {
  disturbances.length = 0;
}

// ---------- trouble mode ----------

/** Multiplier on the random-trouble chances below. */
const TROUBLE_RATE: Record<TroubleMode, number> = { calm: 0, normal: 1, chaos: 4 };

// On globalThis (see `g` above), so a hot reload in dev keeps the chosen mode.
g.__troubleMode ??= 'normal';

export const getTroubleMode = (): TroubleMode => g.__troubleMode ?? 'normal';
export function setTroubleMode(mode: TroubleMode) {
  g.__troubleMode = mode;
}

/** Random trouble per second, so the dashboard has something to show without clicking. */
function maybeStartRandomTrouble() {
  const rate = TROUBLE_RATE[getTroubleMode()];
  if (Math.random() < 0.012 * rate) injectGlitch();
  if (Math.random() < 0.0015 * rate) injectDesyncWave();
  if (Math.random() < 0.004 * rate) injectRamp();
}

/** Starts the 1-second loop. Returns the timer so the runtime can stop it on a hot reload. */
export function startSimulator(intervalMs = 1000): NodeJS.Timeout {
  let busy = false; // skip a tick if the previous one is still writing to the database
  return setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      maybeStartRandomTrouble();
      const ts = new Date();
      await ingest(generateReadings(ts), ts);
    } catch (e) {
      console.error('tick failed', e);
    } finally {
      busy = false;
    }
  }, intervalMs);
}
