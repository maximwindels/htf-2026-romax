import { useState, type ReactNode } from 'react'
import { Activity, Timer } from 'lucide-react'
import { PulseLock } from '#/components/PulseLock.tsx'
import { Stabilizer } from '#/components/Stabilizer.tsx'
import { gameFor, type GameKind, type StabilizeProof } from '#/lib/stabilize.ts'

type StabilizeGameProps = {
  /** A glitch id or anomalySeed(id): picks the game and (for tuning) the target signal. */
  seed: string
  onStabilize: (proof: StabilizeProof) => Promise<unknown>
  onDone?: () => void
  doneLabel?: string
  /** Hint per game; falls back to each game's own explanation. */
  hints?: Partial<Record<GameKind, ReactNode>>
  autoFocus?: boolean
}

/**
 * One of the two mini-games, picked per incident (gameFor), so the stage isn't always the same
 * game. The switch underneath lets anyone swap when a game doesn't suit them (e.g. timing).
 */
export function StabilizeGame({ seed, hints, ...props }: StabilizeGameProps) {
  const [game, setGame] = useState<GameKind>(() => gameFor(seed))
  const other: GameKind = game === 'tune' ? 'pulse' : 'tune'

  return (
    <div className="flex flex-col gap-2">
      {game === 'tune' ? (
        <Stabilizer key="tune" seed={seed} hint={hints?.tune} {...props} />
      ) : (
        <PulseLock key="pulse" hint={hints?.pulse} {...props} />
      )}
      <div className="grid-ui flex justify-end">
        <button
          type="button"
          className="btn-small ghost inline-flex items-center gap-1.5"
          onClick={() => setGame(other)}
          title="Same result, different game"
        >
          {other === 'pulse' ? <Timer className="size-4" /> : <Activity className="size-4" />}
          {other === 'pulse' ? 'Switch to Chrono-Pulse Lock' : 'Switch to frequency tuning'}
        </button>
      </div>
    </div>
  )
}
