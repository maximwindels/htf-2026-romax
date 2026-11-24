import { Zap } from 'lucide-react'
import { useAetherCharges } from '#/dashboard/games.ts'

/**
 * Aether Charges next to a codename: one per flawless mini-game win since the guardian's last fail.
 * Renders nothing at 0. `charges` can be passed when it is already known (leaderboard).
 */
export function AetherBadge({ guardianId, charges }: { guardianId?: string; charges?: number }) {
  const fromBoard = useAetherCharges(charges === undefined ? guardianId : undefined)
  const n = charges ?? fromBoard
  if (n <= 0) return null
  return (
    <span className="aether-badge" title={`${n} Aether Charge${n === 1 ? '' : 's'}: flawless stabilizations in a row`}>
      <Zap className="size-3" strokeWidth={2.5} />
      {n}
    </span>
  )
}
