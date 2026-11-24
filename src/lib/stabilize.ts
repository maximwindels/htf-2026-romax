/**
 * The "stabilize the frequency" mini-game: a glitch in CONTAINING can only be FIXED by
 * tuning frequency and phase to match the glitch's own signal. Shared by client (to draw
 * and check) and server (to verify), so it must stay free of server imports.
 */

export const FREQUENCY = { min: 1, max: 5, step: 0.05, tolerance: 0.12 } as const
export const PHASE = { min: 0, max: 360, step: 1, tolerance: 12 } as const
/** How long both values must stay in tolerance before the glitch is fixed. */
export const HOLD_MS = 2000

/** Small string hash (FNV-1a), so every glitch has its own stable target. */
function hash(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function snap(value: number, step: number) {
  return Math.round(value / step) * step
}

export type Signal = { frequency: number; phase: number }

/** Seed for a grid anomaly's signal, so anomaly 12 and glitch "12" never share a target. */
export const anomalySeed = (id: number) => `AN-${id}`

/** The signal the guardian has to match. `seed` is a glitch id or an anomalySeed(). */
export function targetSignal(seed: string): Signal {
  const h = hash(seed)
  // Keep targets away from the slider ends so they never coincide with the start position.
  const frequency = snap(1.8 + ((h % 1000) / 1000) * 2.6, FREQUENCY.step)
  const phase = snap(60 + (((h >>> 10) % 1000) / 1000) * 240, PHASE.step)
  return { frequency: Number(frequency.toFixed(2)), phase }
}

/** Where the sliders start: deliberately out of tune. */
export const START_SIGNAL: Signal = { frequency: FREQUENCY.min, phase: PHASE.min }

/** Shortest distance between two angles, in degrees. */
export function phaseDistance(a: number, b: number) {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/** 0 = perfectly in tune, 1 = as far off as it gets. */
export function signalError(current: Signal, target: Signal) {
  const f = Math.abs(current.frequency - target.frequency) / (FREQUENCY.max - FREQUENCY.min)
  const p = phaseDistance(current.phase, target.phase) / 180
  return Math.min(1, (f + p) / 2)
}

export function isInTune(current: Signal, target: Signal) {
  return (
    Math.abs(current.frequency - target.frequency) <= FREQUENCY.tolerance &&
    phaseDistance(current.phase, target.phase) <= PHASE.tolerance
  )
}
