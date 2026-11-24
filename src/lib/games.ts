/**
 * Mini-game results and what they do to the world ("Desync Immunity"), shared by client and server.
 * No `#/` imports: drizzle-kit loads this file through the schema.
 *
 * - Every attempt has a time limit. Running out of time is a fail.
 * - A flawless win (pulse: no misses; tune: within FLAWLESS_TUNE_MS) gives the guardian an
 *   Aether Charge and makes the whole grid 10 % more immune: each open error drains less magic.
 * - A fail makes the Desync strike back: +15 % corruption at once (fading out), immunity lost.
 */

export const GAME_KINDS = ['tune', 'pulse'] as const
export type GameKindName = (typeof GAME_KINDS)[number]
export const GAME_RESULTS = ['win', 'fail'] as const
export type GameResult = (typeof GAME_RESULTS)[number]

/** Time per attempt. */
export const GAME_LIMIT_MS = 20_000
/** Frequency tuning counts as flawless when won within this time. */
export const FLAWLESS_TUNE_MS = 10_000

/** Each flawless win multiplies the corruption per error by this, down to the floor. */
export const IMMUNITY_STEP = 0.9
export const IMMUNITY_FLOOR = 0.5
/** A fail adds this much corruption (in magic %), fading out to 0 over fadeMs. */
export const BACKLASH = { points: 15, fadeMs: 120_000 } as const

/** Leaderboard points. */
export const POINTS = { win: 100, flawless: 50, fail: -25 } as const

/** What the client reports about a won attempt (it measures the time). */
export type GameRunMeta = { durationMs: number; flawless: boolean }

/** Grid-wide state the game results change. Lives on the server, pushed live to every screen. */
export type DesyncModifiers = {
  /** Corruption per open error, 1 = normal, 0.5 = half (the best immunity). */
  multiplier: number
  /** Recent backlashes: when, and how many points of corruption. */
  backlash: { at: number; points: number }[]
}

export const NO_MODIFIERS: DesyncModifiers = { multiplier: 1, backlash: [] }

/** Corruption points still left from backlashes at `now`, fading out linearly. */
export function backlashAt(mods: DesyncModifiers, now: number): number {
  return mods.backlash.reduce((sum, b) => sum + b.points * Math.max(0, 1 - (now - b.at) / BACKLASH.fadeMs), 0)
}

export function parseRunMeta(raw: unknown): GameRunMeta {
  const body = (raw ?? {}) as Record<string, unknown>
  const durationMs = Number(body.durationMs)
  return {
    durationMs: Number.isFinite(durationMs) ? Math.max(0, Math.min(GAME_LIMIT_MS, Math.round(durationMs))) : GAME_LIMIT_MS,
    flawless: body.flawless === true,
  }
}

export type LeaderboardRow = {
  guardianId: string
  codename: string
  role: string
  points: number
  wins: number
  flawless: number
  fails: number
  /** Fastest win in ms, or null. */
  bestMs: number | null
  /** Aether Charges: flawless wins since this guardian's last fail. */
  charges: number
}

export type RecentRun = {
  runId: number
  codename: string
  game: GameKindName
  result: GameResult
  flawless: boolean
  durationMs: number
  /** Glitch id or anomaly seed (AN-12). */
  target: string
  timestamp: string
}

export type Leaderboard = { rows: LeaderboardRow[]; recent: RecentRun[] }
