import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { LoaderCircle, RotateCcw, Sparkles } from 'lucide-react'
import { playRuneError, playRuneTone, playStabilized } from '#/dashboard/sound.ts'
import { isTypingTarget } from '#/lib/shortcuts.ts'
import { RUNES, runeSequence, type StabilizeProof } from '#/lib/stabilize.ts'

type Phase = 'intro' | 'showing' | 'input' | 'sending' | 'done'

type RuneSequenceProps = {
  /** Picks the sequence (glitch id or anomaly seed); the server derives the same one. */
  seed: string
  onStabilize: (proof: StabilizeProof) => Promise<unknown>
  onDone?: () => void
  doneLabel?: string
  hint?: ReactNode
  autoFocus?: boolean
  /** Called on every wrong rune, so the caller knows whether the win was flawless. */
  onMiss?: () => void
}

/** The five runes: name, colour and a simple line glyph (40 x 40). */
const RUNE_INFO: { name: string; color: string; glyph: ReactNode }[] = [
  {
    name: 'Sol',
    color: '#5b9bff',
    glyph: (
      <>
        <circle cx="20" cy="20" r="6" />
        {Array.from({ length: 8 }, (_, i) => (
          <line key={i} x1="20" y1="6" x2="20" y2="10" transform={`rotate(${i * 45} 20 20)`} />
        ))}
      </>
    ),
  },
  { name: 'Luna', color: '#e292f4', glyph: <path d="M25 7 A13 13 0 1 0 25 33 A10 10 0 1 1 25 7 Z" /> },
  {
    name: 'Tide',
    color: '#4fd1c5',
    glyph: <path d="M6 13 q4 -5 7 0 t7 0 t7 0 t7 0 M6 20 q4 -5 7 0 t7 0 t7 0 t7 0 M6 27 q4 -5 7 0 t7 0 t7 0 t7 0" />,
  },
  {
    name: 'Ember',
    color: '#f48d30',
    glyph: (
      <>
        <path d="M20 5 C29 15 31 23 25 31 C23 34 17 34 15 31 C9 23 12 15 20 5 Z" />
        <path d="M20 18 C23 22 23 26 20 29 C17 26 17 22 20 18 Z" />
      </>
    ),
  },
  {
    name: 'Hourglass',
    color: '#e6c341',
    glyph: (
      <>
        <path d="M11 6 H29 L11 34 H29 Z" />
        <line x1="9" y1="6" x2="31" y2="6" />
        <line x1="9" y1="34" x2="31" y2="34" />
      </>
    ),
  },
]

/**
 * Mini-game 3, "Rune Sequence": five runes light up in an order, each with its own tone.
 * Repeat it by clicking / tapping the runes or with keys 1-5. A wrong rune replays the
 * sequence and you start over. The server knows the sequence too, so it checks the answer.
 */
export function RuneSequence({ seed, onStabilize, onDone, doneLabel = 'Runes sealed', hint, autoFocus, onMiss }: RuneSequenceProps) {
  const sequence = useRef(runeSequence(seed)).current
  const [phase, setPhase] = useState<Phase>('intro')
  const [lit, setLit] = useState<number | null>(null)
  const [entered, setEntered] = useState(0)
  const [wrong, setWrong] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const phaseRef = useRef<Phase>('intro')
  const inputRef = useRef<number[]>([])
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const firstRuneRef = useRef<HTMLButtonElement>(null)

  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms))
  const go = (next: Phase) => {
    phaseRef.current = next
    setPhase(next)
  }

  /** Play the whole sequence: each rune lights up with its tone, then it's your turn. */
  function play() {
    go('showing')
    inputRef.current = []
    setEntered(0)
    const step = RUNES.litMs + RUNES.gapMs
    sequence.forEach((rune, i) => {
      later(i * step, () => {
        setLit(rune)
        playRuneTone(rune, RUNES.litMs)
      })
      later(i * step + RUNES.litMs, () => setLit(null))
    })
    later(sequence.length * step, () => go('input'))
  }

  async function submit() {
    go('sending')
    setError(null)
    try {
      await onStabilize({ kind: 'runes', sequence: [...inputRef.current] })
      go('done')
      playStabilized()
      if (onDone) later(1600, onDone)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The runes did not hold')
      later(900, play)
    }
  }

  function press(rune: number) {
    if (phaseRef.current !== 'input') return
    setLit(rune)
    later(180, () => setLit((l) => (l === rune ? null : l)))

    const i = inputRef.current.length
    if (rune !== sequence[i]) {
      // Wrong rune: buzz, shake, and the sequence plays again from the start.
      onMiss?.()
      playRuneError()
      setWrong(true)
      later(420, () => setWrong(false))
      inputRef.current = []
      setEntered(0)
      go('showing') // block input until the replay starts
      later(900, play)
      return
    }
    playRuneTone(rune, 260)
    inputRef.current = [...inputRef.current, rune]
    setEntered(inputRef.current.length)
    if (inputRef.current.length === sequence.length) void submit()
  }
  const pressRef = useRef(press)
  pressRef.current = press

  // Start with a beat of "watch", then play. Clean up every pending timer on unmount.
  useEffect(() => {
    later(700, play)
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
    // Runs once: the sequence is fixed per seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keys 1-5, but never while someone is typing (e.g. in the echo form).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTypingTarget(e.target)) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= RUNES.count && phaseRef.current === 'input') {
        e.preventDefault()
        pressRef.current(n - 1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (autoFocus) firstRuneRef.current?.focus()
  }, [autoFocus])

  const status =
    phase === 'done'
      ? 'SEALED'
      : phase === 'sending'
        ? 'SEALING'
        : wrong
          ? 'WRONG RUNE'
          : phase === 'input'
            ? `YOUR TURN ${entered}/${sequence.length}`
            : 'WATCH'
  const state = phase === 'done' ? 'is-done' : phase === 'input' ? 'is-tuned' : ''

  return (
    // data-owns-digit-keys: the global 1-8 tab shortcut steps aside while this game is shown.
    <section className={`grid-ui stabilizer rune-game ${state} ${wrong ? 'is-miss' : ''}`} data-owns-digit-keys>
      <div className="stabilizer-head">
        <div>
          <h2 className="stabilizer-title m-0 border-0 p-0">
            <Sparkles className="size-5" />
            Rune Sequence
          </h2>
          <p className="stabilizer-hint m-0">
            {hint ?? (
              <>
                Watch the order in which the runes light up, then repeat it: click, tap or press{' '}
                <kbd className="kbd">1</kbd>–<kbd className="kbd">5</kbd>. A wrong rune replays the sequence.
              </>
            )}
          </p>
        </div>
        <RuneBadge phase={phase} wrong={wrong} />
      </div>

      <div className="rune-board">
        <div className={`rune-status ${wrong ? 'is-wrong' : ''}`}>{status}</div>
        {RUNE_INFO.map((rune, i) => {
          const angle = (-90 + i * (360 / RUNES.count)) * (Math.PI / 180)
          const style = {
            '--rune-color': rune.color,
            left: `calc(50% + ${Math.cos(angle) * 108}px)`,
            top: `calc(50% + ${Math.sin(angle) * 96}px)`,
          } as CSSProperties
          return (
            <button
              key={rune.name}
              ref={i === 0 ? firstRuneRef : undefined}
              type="button"
              className={`rune ${lit === i ? 'is-lit' : ''}`}
              style={style}
              data-stabilizer-start={i === 0 || undefined}
              disabled={phase !== 'input'}
              aria-label={`Rune ${i + 1}: ${rune.name}`}
              onPointerDown={(e) => {
                e.preventDefault()
                press(i)
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
                  e.preventDefault()
                  press(i)
                }
              }}
            >
              <svg viewBox="0 0 40 40" aria-hidden>
                {rune.glyph}
              </svg>
              <span className="rune-key">{i + 1}</span>
            </button>
          )
        })}
        {phase === 'done' && <span className="ribbon rune-done m-0">{doneLabel}</span>}
      </div>

      <div className="pulse-combo" aria-label={`${entered} of ${sequence.length} runes`}>
        <span className="pulse-combo-label">Sequence</span>
        {sequence.map((_, i) => (
          <span key={i} className={`pulse-pip ${i < entered || phase === 'done' ? 'is-on' : ''}`} />
        ))}
        {phase === 'input' && entered === 0 && (
          <button type="button" className="btn-small ghost inline-flex items-center gap-1" onClick={play}>
            <RotateCcw className="size-3.5" /> Replay
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="stab-error m-0">
          {error}
        </p>
      )}
    </section>
  )
}

function RuneBadge({ phase, wrong }: { phase: Phase; wrong: boolean }) {
  if (phase === 'sending')
    return (
      <span className="badge badge-ok inline-flex shrink-0 items-center gap-1.5">
        <LoaderCircle className="size-3 animate-spin" /> Sealing
      </span>
    )
  if (phase === 'done') return <span className="badge badge-medium shrink-0">Sealed</span>
  if (wrong) return <span className="badge badge-critical shrink-0">Wrong</span>
  if (phase === 'input') return <span className="badge badge-ok shrink-0">Your turn</span>
  return <span className="badge badge-high shrink-0">Watch</span>
}
