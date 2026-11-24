import { createServerFn } from '@tanstack/react-start'
import { requireGuardian } from '#/lib/auth.server.ts'
import { GAME_KINDS, GAME_LIMIT_MS, type DesyncModifiers, type GameKindName, type Leaderboard } from '#/lib/games.ts'
import { getModifiers, leaderboard, recordRun } from '#/lib/games.server.ts'

export const getLeaderboard = createServerFn({ method: 'GET' }).handler(async (): Promise<Leaderboard> => {
  requireGuardian()
  return leaderboard()
})

export const getDesyncModifiers = createServerFn({ method: 'GET' }).handler(async (): Promise<DesyncModifiers> => {
  requireGuardian()
  return getModifiers()
})

/**
 * The timer ran out: the attempt is a fail and the Desync strikes back.
 * (Wins are recorded by the stabilize calls themselves, together with the proof.)
 */
export const recordGameFail = createServerFn({ method: 'POST' })
  .validator((data: { game: GameKindName; target: string }) => {
    if (!GAME_KINDS.includes(data?.game)) throw new Error('Unknown game')
    return { game: data.game, target: String(data.target ?? '').slice(0, 40) }
  })
  .handler(async ({ data }) => {
    const guardian = requireGuardian()
    recordRun(guardian, { ...data, result: 'fail', flawless: false, durationMs: GAME_LIMIT_MS })
  })
