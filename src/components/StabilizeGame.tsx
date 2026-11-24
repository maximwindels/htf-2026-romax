import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Activity, RotateCcw, Timer, Zap } from 'lucide-react'
import { PulseLock } from '#/components/PulseLock.tsx'
import { Stabilizer } from '#/components/Stabilizer.tsx'
import { recordGameFail } from '#/lib/games.functions.ts'
import { FLAWLESS_TUNE_MS, GAME_LIMIT_MS, type GameRunMeta } from '#/lib/games.ts'
import { gameFor, type GameKind, type StabilizeProof } from '#/lib/stabilize.ts'

type StabilizeGameProps = {
  /** A glitch id or anomalySeed(id): picks the game and (for tuning) the target signal. */
  seed: string
  /** Sends proof of the win plus how it went (time, flawless) to the server. */
  onStabilize: (proof: StabilizeProof, run: GameRunMeta) => Promise<unknown>
  onDone?: () => void
  doneLabel?: string
  /** Hint per game; falls back to each game's own explanation. */
  hints?: Partial<Record<GameKind, ReactNode>>
  autoFocus?: boolean
}

type Outcome = { kind: 'playing' } | { kind: 'won'; run: GameRunMeta } | { kind: 'failed' }

/**
 * One of the two mini-games, picked per incident (gameFor), with a time limit.
 * - Out of time: a fail. The server records it and the Desync strikes back for everyone.
 * - Won without a miss (pulse) or within 10 s (tune): flawless, worth an Aether Charge.
 * The switch underneath swaps the game; it also starts a fresh attempt.
 */
export function StabilizeGame({ seed, hints, onStabilize, ...props }: StabilizeGameProps) {
  const [game, setGame] = useState<GameKind>(() => gameFor(seed))
  const [attempt, setAttempt] = useState(0)
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'playing' })
  const startedAt = useRef(0)
  const misses = useRef(0)
  const other: GameKind = game === 'tune' ? 'pulse' : 'tune'

  // A new attempt (first one, retry, or game switch) starts a fresh clock.
  useEffect(() => {
    startedAt.current = performance.now()
    misses.current = 0
    setOutcome({ kind: 'playing' })
  }, [attempt, game])

  async function win(proof: StabilizeProof) {
    const durationMs = Math.round(performance.now() - startedAt.current)
    const flawless = game === 'pulse' ? misses.current === 0 : durationMs <= FLAWLESS_TUNE_MS
    const run = { durationMs, flawless }
    await onStabilize(proof, run) // throws on a server refusal: the game shows the error
    setOutcome({ kind: 'won', run })
  }

  function fail() {
    setOutcome({ kind: 'failed' })
    // The server records the fail and tells every screen (backlash banner + stinger there).
    void recordGameFail({ data: { game, target: seed } }).catch(() => {})
  }

  const gameProps = { ...props, onStabilize: win }

  return (
    <div className="flex flex-col gap-2">
      {outcome.kind === 'playing' && <GameTimer key={`timer-${game}-${attempt}`} startedAt={startedAt} onExpire={fail} />}

      {outcome.kind === 'failed' ? (
        <section className="grid-ui stabilizer game-failed">
          <div className="stabilizer-head">
            <div>
              <h2 className="stabilizer-title m-0 border-0 p-0">Time's up</h2>
              <p className="stabilizer-hint m-0">
                The Desync strikes back: corruption +15 % and the grid's immunity is gone. Try again before it spreads.
              </p>
            </div>
            <span className="badge badge-critical shrink-0">Failed</span>
          </div>
          <div>
            <button type="button" className="inline-flex items-center gap-2" onClick={() => setAttempt((a) => a + 1)} autoFocus>
              <RotateCcw className="size-4" />
              Try again
            </button>
          </div>
        </section>
      ) : game === 'tune' ? (
        <Stabilizer key={`tune-${attempt}`} seed={seed} hint={hints?.tune} {...gameProps} />
      ) : (
        <PulseLock
          key={`pulse-${attempt}`}
          hint={hints?.pulse}
          onMiss={() => (misses.current += 1)}
          {...gameProps}
        />
      )}

      {outcome.kind === 'won' && (
        <p className={`grid-ui game-result ${outcome.run.flawless ? 'is-flawless' : ''}`}>
          {outcome.run.flawless ? <Zap className="size-4" /> : null}
          {outcome.run.flawless
            ? `Flawless in ${(outcome.run.durationMs / 1000).toFixed(1)} s: +1 Aether Charge, the grid is 10 % more immune`
            : `Stabilized in ${(outcome.run.durationMs / 1000).toFixed(1)} s`}
        </p>
      )}

      {outcome.kind !== 'won' && (
        <div className="grid-ui flex justify-end">
          <button
            type="button"
            className="btn-small ghost inline-flex items-center gap-1.5"
            onClick={() => setGame(other)}
            title="Same result, different game (starts a new attempt)"
          >
            {other === 'pulse' ? <Timer className="size-4" /> : <Activity className="size-4" />}
            {other === 'pulse' ? 'Switch to Chrono-Pulse Lock' : 'Switch to frequency tuning'}
          </button>
        </div>
      )}
    </div>
  )
}

/** Countdown bar above the game; calls onExpire once when the time is up. */
function GameTimer({ startedAt, onExpire }: { startedAt: React.RefObject<number>; onExpire: () => void }) {
  const [left, setLeft] = useState(GAME_LIMIT_MS)
  const expired = useRef(false)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    const id = setInterval(() => {
      const remaining = Math.max(0, GAME_LIMIT_MS - (performance.now() - startedAt.current))
      setLeft(remaining)
      if (remaining === 0 && !expired.current) {
        expired.current = true
        onExpireRef.current()
      }
    }, 100)
    return () => clearInterval(id)
  }, [startedAt])

  const urgent = left <= 5000
  return (
    <div className={`grid-ui game-timer ${urgent ? 'is-urgent' : ''}`} role="timer" aria-live="off">
      <Timer className="size-4" />
      <span className="game-timer-bar" aria-hidden>
        <span style={{ width: `${(left / GAME_LIMIT_MS) * 100}%` }} />
      </span>
      <span className="game-timer-text mono">{(left / 1000).toFixed(1)} s</span>
    </div>
  )
}
