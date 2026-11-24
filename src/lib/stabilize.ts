/**
 * The stabilize mini-games: a glitch in CONTAINING (or a critical anomaly) can only be cleared by
 * winning one. Game 1 "tune": match frequency and phase to the incident's own signal.
 * Game 2 "pulse" (Chrono-Pulse Lock): stop the sweeping hand in the zone, twice in a row.
 * Game 3 "runes" (Rune Sequence): repeat the order in which five runes light up.
 * Shared by client (to draw and check) and server (to verify), so it must stay free of server imports.
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

// ---------- second mini-game: Chrono-Pulse Lock ----------

/**
 * A skill check on a clock face: a hand sweeps clockwise from 12 o'clock; press Space / tap
 * while it passes through the marked zone. Two hits in a row lock the timeline. Angles in degrees.
 */
export const PULSE = {
  /** Time for one full turn of the hand, per round (the second one is faster). */
  durationsMs: [1300, 1050],
  /** Width of the hit zone, and of the "great" part at its start. */
  zoneDeg: 30,
  greatDeg: 9,
  /** The zone starts somewhere in this range, so the hand always travels a bit first. */
  zoneStartMinDeg: 110,
  zoneStartMaxDeg: 300,
  hitsNeeded: 2,
  /** Pause after a hit or miss before the next turn starts. */
  restMs: 550,
} as const

/** Server tolerance for a reported hit: looser than the zone (about 55 ms each side), for frame timing. */
export const PULSE_MAX_OFFSET_MS = 160

// ---------- third mini-game: Rune Sequence ----------

/** Five runes light up in an order; repeat it. A wrong rune replays the sequence. */
export const RUNES = {
  count: 5,
  length: 5,
  /** How long each rune stays lit while the sequence plays, and the gap between them. */
  litMs: 520,
  gapMs: 160,
} as const

/**
 * The sequence for an incident, derived from its seed: the server can compute it too, so this
 * proof is checked for real. No rune twice in a row, so every step is a visible change.
 */
export function runeSequence(seed: string): number[] {
  let h = hash(`${seed}:runes`)
  const out: number[] = []
  while (out.length < RUNES.length) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0
    const rune = h % RUNES.count
    if (rune !== out.at(-1)) out.push(rune)
  }
  return out
}

export const GAME_KINDS_ALL = ['tune', 'pulse', 'runes'] as const
export type GameKind = (typeof GAME_KINDS_ALL)[number]

/** Which mini-game an incident gets: fixed per seed, so it's varied but the same every time. */
export function gameFor(seed: string): GameKind {
  return GAME_KINDS_ALL[hash(`${seed}:game`) % GAME_KINDS_ALL.length]
}

/**
 * What the client sends when a mini-game is won.
 * Note: both are reported by the browser. They stop a plain click from skipping the game,
 * not a determined cheater (the target is computed in the browser too).
 */
export type StabilizeProof =
  | ({ kind: 'tune' } & Signal)
  /** How far each hit was from the middle of the zone, in ms (0 = dead centre). */
  | { kind: 'pulse'; offsetsMs: number[] }
  /** The runes in the order they were entered. */
  | { kind: 'runes'; sequence: number[] }

/** Reads a proof from an untrusted request body. A bare { frequency, phase } counts as 'tune'. */
export function parseProof(raw: unknown): StabilizeProof | null {
  const body = (raw ?? {}) as Record<string, unknown>
  if (body.kind === 'pulse') {
    const offsets = Array.isArray(body.offsetsMs) ? body.offsetsMs.map(Number) : []
    return { kind: 'pulse', offsetsMs: offsets }
  }
  if (body.kind === 'runes') {
    const sequence = Array.isArray(body.sequence) ? body.sequence.map(Number).slice(0, 20) : []
    return { kind: 'runes', sequence }
  }
  const frequency = Number(body.frequency)
  const phase = Number(body.phase)
  if (!Number.isFinite(frequency) || !Number.isFinite(phase)) return null
  return { kind: 'tune', frequency, phase }
}

export function verifyProof(seed: string, proof: StabilizeProof | null): boolean {
  if (!proof) return false
  if (proof.kind === 'tune') return isInTune(proof, targetSignal(seed))
  if (proof.kind === 'runes') {
    // The only proof the server can check for real: it knows the sequence too.
    const expected = runeSequence(seed)
    return proof.sequence.length === expected.length && proof.sequence.every((r, i) => r === expected[i])
  }
  return (
    proof.offsetsMs.length >= PULSE.hitsNeeded &&
    proof.offsetsMs.every((ms) => Number.isFinite(ms) && Math.abs(ms) <= PULSE_MAX_OFFSET_MS)
  )
}

/** Echo text for the glitch timeline. */
export function describeProof(proof: StabilizeProof): string {
  if (proof.kind === 'tune') {
    return `Stabilized the frequency at ${proof.frequency.toFixed(2)} Hz, phase ${Math.round(proof.phase)}°. Glitch fixed.`
  }
  if (proof.kind === 'runes') return `Echoed the rune sequence (${proof.sequence.length} runes). Glitch fixed.`
  const worst = Math.max(...proof.offsetsMs.map((ms) => Math.abs(Math.round(ms))))
  return `Locked the chrono-pulse: ${proof.offsetsMs.length} hits in a row, within ${worst} ms. Glitch fixed.`
}
