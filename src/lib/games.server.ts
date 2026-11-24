// Server-only: mini-game results, the grid-wide Desync Immunity state and the leaderboard.
// Kept out of *.functions.ts files so the client bundle never pulls in the database or the bus.
import { desc, eq } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { gameRuns, guardians } from '#/db/schema.ts'
import {
  BACKLASH,
  IMMUNITY_FLOOR,
  IMMUNITY_STEP,
  POINTS,
  type DesyncModifiers,
  type GameKindName,
  type GameResult,
  type Leaderboard,
  type LeaderboardRow,
} from '#/lib/games.ts'
import type { Guardian } from '#/lib/guardian.ts'
import { bus } from '#/server/grid/bus.ts'

// On globalThis, so a hot reload in dev keeps the state (and every module copy shares it).
const g = globalThis as typeof globalThis & { __desyncModifiers?: DesyncModifiers }
g.__desyncModifiers ??= { multiplier: 1, backlash: [] }

/** Current immunity and backlash, with backlashes that have fully faded removed. */
export function getModifiers(): DesyncModifiers {
  const mods = g.__desyncModifiers!
  const now = Date.now()
  mods.backlash = mods.backlash.filter((b) => now - b.at < BACKLASH.fadeMs)
  return { multiplier: mods.multiplier, backlash: [...mods.backlash] }
}

type RunInput = {
  game: GameKindName
  result: GameResult
  flawless: boolean
  durationMs: number
  target: string
}

/**
 * Store one finished attempt and apply it to the world:
 * - flawless win: the grid gets 10 % more immune (down to the floor)
 * - fail: the Desync strikes back with +15 % corruption, and the immunity is gone
 * Every screen hears about it live (`modifiers` and `run` events).
 */
export function recordRun(guardian: Guardian, run: RunInput) {
  db.insert(gameRuns)
    .values({
      guardianId: guardian.guardianId,
      game: run.game,
      result: run.result,
      flawless: run.result === 'win' && run.flawless,
      durationMs: Math.round(run.durationMs),
      target: run.target,
      timestamp: new Date().toISOString(),
    })
    .run()

  const mods = g.__desyncModifiers!
  if (run.result === 'win' && run.flawless) {
    mods.multiplier = Math.max(IMMUNITY_FLOOR, Number((mods.multiplier * IMMUNITY_STEP).toFixed(3)))
  } else if (run.result === 'fail') {
    mods.multiplier = 1
    mods.backlash.push({ at: Date.now(), points: BACKLASH.points })
  }
  bus.emit('modifiers', getModifiers())
  bus.emit('run', { guardianId: guardian.guardianId, result: run.result, flawless: run.flawless })
}

/** Points, counts, best time and Aether Charges per guardian, plus the latest runs. */
export function leaderboard(): Leaderboard {
  const people = db.select().from(guardians).all()
  // Newest first, so a guardian's Aether Charges are the flawless wins before their latest fail.
  const runs = db
    .select({
      runId: gameRuns.runId,
      guardianId: gameRuns.guardianId,
      codename: guardians.codename,
      game: gameRuns.game,
      result: gameRuns.result,
      flawless: gameRuns.flawless,
      durationMs: gameRuns.durationMs,
      target: gameRuns.target,
      timestamp: gameRuns.timestamp,
    })
    .from(gameRuns)
    .innerJoin(guardians, eq(gameRuns.guardianId, guardians.guardianId))
    .orderBy(desc(gameRuns.timestamp), desc(gameRuns.runId))
    .all()

  const rows: LeaderboardRow[] = people.map((p) => {
    const mine = runs.filter((r) => r.guardianId === p.guardianId)
    const wins = mine.filter((r) => r.result === 'win')
    const flawless = wins.filter((r) => r.flawless).length
    const fails = mine.length - wins.length
    let charges = 0
    for (const r of mine) {
      if (r.result === 'fail') break
      if (r.flawless) charges++
    }
    return {
      guardianId: p.guardianId,
      codename: p.codename,
      role: p.role,
      points: wins.length * POINTS.win + flawless * POINTS.flawless + fails * POINTS.fail,
      wins: wins.length,
      flawless,
      fails,
      bestMs: wins.length ? Math.min(...wins.map((r) => r.durationMs)) : null,
      charges,
    }
  })
  rows.sort((a, b) => b.points - a.points || (a.bestMs ?? Infinity) - (b.bestMs ?? Infinity))

  const recent = runs.slice(0, 12).map(({ guardianId: _, ...r }) => r)
  return { rows, recent }
}
