import { useQuery } from '@tanstack/react-query'
import { getDesyncModifiers, getLeaderboard } from '#/lib/games.functions.ts'
import { NO_MODIFIERS } from '#/lib/games.ts'

/** Query keys; live.ts updates them from the SSE `modifiers` and `run` events. */
export const gamesQk = {
  modifiers: ['desync-modifiers'] as const,
  leaderboard: ['leaderboard'] as const,
}

/** Grid-wide immunity and backlash, kept live by the SSE stream. */
export function useDesyncModifiers() {
  const { data } = useQuery({
    queryKey: gamesQk.modifiers,
    queryFn: () => getDesyncModifiers(),
    staleTime: Infinity,
  })
  return data ?? NO_MODIFIERS
}

export function useLeaderboard() {
  return useQuery({ queryKey: gamesQk.leaderboard, queryFn: () => getLeaderboard(), staleTime: 30_000 })
}

/** A guardian's current Aether Charges (flawless wins since their last fail). */
export function useAetherCharges(guardianId: string | undefined) {
  const { data } = useLeaderboard()
  return data?.rows.find((r) => r.guardianId === guardianId)?.charges ?? 0
}
