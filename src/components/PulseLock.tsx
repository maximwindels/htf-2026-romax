import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LoaderCircle, Timer } from 'lucide-react'
import { playStabilized } from '#/dashboard/sound.ts'
import { PULSE, type StabilizeProof } from '#/lib/stabilize.ts'

type Stage = 'playing' | 'sending' | 'done'
type Feedback = 'great' | 'hit' | 'miss' | null

type PulseLockProps = {
  /** Sends proof of the won game to the server, which re-checks it. Throw to show an error. */
  onStabilize: (proof: StabilizeProof) => Promise<unknown>
  /** Runs a moment after success, once the success state has been seen. */
  onDone?: () => void
  doneLabel?: string
  hint?: ReactNode
  /** Focus the pad on mount (used in the anomaly dialog). */
  autoFocus?: boolean
}

const VIEW = 320
const C = VIEW / 2
const R = 112 // radius of the clock face track

/** Point on the clock face: 0° is 12 o'clock, angles run clockwise. */
function point(deg: number, r = R) {
  const rad = ((deg - 90) * Math.PI) / 180
  return `${(C + r * Math.cos(rad)).toFixed(2)} ${(C + r * Math.sin(rad)).toFixed(2)}`
}
/** Clockwise arc along the track (handles arcs over 180°, for the hand's trail). */
function arc(fromDeg: number, toDeg: number, r = R) {
  const sweep = Math.min(359.9, Math.max(0, toDeg - fromDeg))
  const large = sweep > 180 ? 1 : 0
  return `M${point(fromDeg, r)} A${r} ${r} 0 ${large} 1 ${point(fromDeg + sweep, r)}`
}
/** The two short cut lines that mark the start and end of the zone. */
function zoneEdges(fromDeg: number, toDeg: number) {
  return `M${point(fromDeg, R - 12)}L${point(fromDeg, R + 12)}M${point(toDeg, R - 12)}L${point(toDeg, R + 12)}`
}

/** The clock hand: tapered blade from a counterweight to the tip, pointing at 12 o'clock. */
const HAND = [
  [C - 4, C + 22],
  [C + 4, C + 22],
  [C + 2, C - R + 18],
  [C, C - R - 10],
  [C - 2, C - R + 18],
]
  .map((p) => p.join(','))
  .join(' ')

/** Start the "warning" glow on the zone when the hand is this many degrees away. */
const NEAR_DEG = 50
const NUMERALS = [
  { deg: 0, text: 'XII' },
  { deg: 90, text: 'III' },
  { deg: 180, text: 'VI' },
  { deg: 270, text: 'IX' },
]

/**
 * Mini-game 2, "Chrono-Pulse Lock": a skill check on a clock face. A hand sweeps clockwise
 * from 12 o'clock; press Space (or tap / click) while it is inside the marked zone. The first
 * part of the zone is "great". Two hits in a row lock the timeline; the second turn is faster.
 * Pressing early, or letting the hand pass the zone, is a miss: combo reset and a small shake.
 */
export function PulseLock({ onStabilize, onDone, doneLabel = 'Timeline locked', hint, autoFocus }: PulseLockProps) {
  const [stage, setStage] = useState<Stage>('playing')
  const [combo, setCombo] = useState(0)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [error, setError] = useState<string | null>(null)
  /** Sparks at the spot of the last hit; the key restarts the CSS animation. */
  const [burst, setBurst] = useState<{ key: number; angle: number; great: boolean } | null>(null)

  // The animation loop and the key handler share these refs, so neither has to restart.
  const needleRef = useRef<SVGGElement>(null)
  const trailRef = useRef<SVGPathElement>(null)
  const zoneGroupRef = useRef<SVGGElement>(null)
  const zoneBorderRef = useRef<SVGPathElement>(null)
  const zoneRef = useRef<SVGPathElement>(null)
  const greatRef = useRef<SVGPathElement>(null)
  const zoneEdgesRef = useRef<SVGPathElement>(null)
  const padRef = useRef<HTMLButtonElement>(null)
  const stageRef = useRef<Stage>('playing')
  const comboRef = useRef(0)
  const offsetsRef = useRef<number[]>([])
  /** When the hand started this turn; null while resting between turns. */
  const turnStartRef = useRef<number | null>(null)
  const zoneStartRef = useRef(0)
  const restUntilRef = useRef(0)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const duration = () => PULSE.durationsMs[Math.min(comboRef.current, PULSE.durationsMs.length - 1)]
  /** Hand angle in degrees, from the time since the turn started. */
  const angleAt = (now: number) =>
    turnStartRef.current === null ? 0 : ((now - turnStartRef.current) / duration()) * 360

  function flash(kind: Feedback) {
    setFeedback(kind)
    clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback(null), 420)
  }

  function rest() {
    turnStartRef.current = null
    restUntilRef.current = performance.now() + PULSE.restMs
  }

  /** A new turn: put the zone somewhere new and start the hand at 12 o'clock. */
  function startTurn(now: number) {
    const span = PULSE.zoneStartMaxDeg - PULSE.zoneStartMinDeg
    const start = PULSE.zoneStartMinDeg + Math.random() * span
    const end = start + PULSE.zoneDeg
    zoneStartRef.current = start
    zoneBorderRef.current?.setAttribute('d', arc(start - 1, end + 1))
    zoneRef.current?.setAttribute('d', arc(start, end))
    greatRef.current?.setAttribute('d', arc(start, start + PULSE.greatDeg))
    zoneEdgesRef.current?.setAttribute('d', zoneEdges(start, end))
    turnStartRef.current = now
  }

  function miss() {
    comboRef.current = 0
    offsetsRef.current = []
    setCombo(0)
    flash('miss')
    rest()
  }

  async function submit() {
    stageRef.current = 'sending'
    setStage('sending')
    setError(null)
    try {
      await onStabilize({ kind: 'pulse', offsetsMs: offsetsRef.current })
      stageRef.current = 'done'
      setStage('done')
      playStabilized()
      if (onDone) setTimeout(onDone, 1600)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lock failed')
      comboRef.current = 0
      offsetsRef.current = []
      setCombo(0)
      stageRef.current = 'playing'
      setStage('playing')
      rest()
    }
  }

  function press() {
    if (stageRef.current !== 'playing' || turnStartRef.current === null) return
    const angle = angleAt(performance.now())
    const zoneStart = zoneStartRef.current
    if (angle < zoneStart || angle > zoneStart + PULSE.zoneDeg) return miss()

    // Report timing, not degrees: how far from the middle of the zone, in ms.
    const center = zoneStart + PULSE.zoneDeg / 2
    offsetsRef.current.push(Math.round(((angle - center) / 360) * duration()))
    comboRef.current += 1
    setCombo(comboRef.current)
    const great = angle <= zoneStart + PULSE.greatDeg
    flash(great ? 'great' : 'hit')
    setBurst({ key: performance.now(), angle, great })
    if (comboRef.current >= PULSE.hitsNeeded) {
      turnStartRef.current = null
      void submit()
    } else {
      rest()
    }
  }

  // The animation loop runs once, so it calls the latest miss() through a ref.
  const missRef = useRef(miss)
  missRef.current = miss

  useEffect(() => {
    let frame = 0
    restUntilRef.current = performance.now() + 700 // a beat before the first turn
    const tick = (now: number) => {
      const needle = needleRef.current
      const playing = stageRef.current === 'playing'
      if (playing && turnStartRef.current === null && now >= restUntilRef.current) startTurn(now)

      const active = playing && turnStartRef.current !== null
      const angle = angleAt(now)
      // The hand went past the zone without a press: that's a miss.
      if (active && angle > zoneStartRef.current + PULSE.zoneDeg) missRef.current()

      if (needle) {
        needle.setAttribute('transform', `rotate(${active ? angle : 0} ${C} ${C})`)
        needle.style.opacity = active ? '1' : '0'
      }
      // A faint trail behind the hand, so the speed is easy to read.
      trailRef.current?.setAttribute('d', active && angle > 1 ? arc(Math.max(0, angle - 70), angle, R - 20) : '')
      const zone = zoneGroupRef.current
      if (zone) {
        zone.style.opacity = active || stageRef.current === 'done' ? '1' : '0'
        // Warn as the hand comes close: the zone lights up.
        const ahead = zoneStartRef.current - angle
        zone.classList.toggle('is-near', active && ahead > -PULSE.zoneDeg && ahead < NEAR_DEG)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(feedbackTimer.current)
    }
    // Runs once; everything it reads lives in refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (autoFocus) padRef.current?.focus()
  }, [autoFocus])

  const state = stage === 'done' ? 'is-done' : feedback === 'hit' || feedback === 'great' ? 'is-tuned' : ''
  const centerText =
    stage === 'done' ? 'LOCKED' : feedback === 'great' ? 'GREAT' : feedback === 'hit' ? 'GOOD' : feedback === 'miss' ? 'MISS' : '[ SPACE ]'

  return (
    // Same frame as the frequency stabilizer (grid.css .stabilizer), plus .pulse-lock bits.
    <section className={`grid-ui stabilizer pulse-lock ${state} ${feedback === 'miss' ? 'is-miss' : ''}`}>
      <div className="stabilizer-head">
        <div>
          <h2 className="stabilizer-title m-0 border-0 p-0">
            <Timer className="size-5" />
            Chrono-Pulse Lock
          </h2>
          <p className="stabilizer-hint m-0">
            {hint ??
              'Press Space or tap while the hand is inside the marked zone. Two hits in a row snap the timeline back.'}
          </p>
        </div>
        <PulseBadge stage={stage} feedback={feedback} />
      </div>

      <button
        ref={padRef}
        type="button"
        className="pulse-pad"
        data-stabilizer-start
        aria-label="Skill check: press Space or tap while the hand is inside the zone"
        disabled={stage !== 'playing'}
        onPointerDown={(e) => {
          e.preventDefault() // keep focus on the pad, and react on press, not release
          padRef.current?.focus()
          press()
        }}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault()
            press()
          }
        }}
      >
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden>
          <defs>
            <radialGradient id="skill-dial" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#21173a" />
              <stop offset="100%" stopColor="#0d0916" />
            </radialGradient>
          </defs>

          {/* dial: lit face, outer track, fine inner ring, hour ticks and numerals */}
          <circle className="skill-face" cx={C} cy={C} r={R + 24} />
          <circle className="skill-track" cx={C} cy={C} r={R} />
          <circle className="skill-inner-ring" cx={C} cy={C} r={R - 20} />
          {Array.from({ length: 60 }, (_, i) => (
            <line
              key={i}
              className={i % 5 === 0 ? 'skill-tick is-hour' : 'skill-tick'}
              x1={C}
              y1={C - R - 9}
              x2={C}
              y2={C - R - (i % 15 === 0 ? 20 : i % 5 === 0 ? 16 : 12)}
              transform={`rotate(${i * 6} ${C} ${C})`}
            />
          ))}
          {NUMERALS.map(({ deg, text }) => {
            const [x, y] = point(deg, R - 38).split(' ').map(Number)
            return (
              <text key={text} className="skill-numeral" x={x} y={y + 5} textAnchor="middle">
                {text}
              </text>
            )
          })}

          {/* the zone: dark border, light band, solid "great" start, sharp cut lines */}
          <g ref={zoneGroupRef} className="skill-zone-group">
            <path ref={zoneBorderRef} className="skill-zone-border" />
            <path ref={zoneRef} className="skill-zone" />
            <path ref={greatRef} className="skill-great" />
            <path ref={zoneEdgesRef} className="skill-zone-edges" />
          </g>

          {/* the hand with a short trail behind it */}
          <path ref={trailRef} className="skill-trail" />
          <g ref={needleRef} className="skill-needle">
            <polygon points={HAND} />
            <circle cx={C} cy={C + 22} r={6} />
          </g>
          <circle className="skill-hub" cx={C} cy={C} r={9} />
          <circle className="skill-hub-dot" cx={C} cy={C} r={3} />

          {/* sparks where the hit landed */}
          {burst && (
            <g key={burst.key} className={`skill-burst ${burst.great ? 'is-great' : ''}`}>
              {Array.from({ length: 8 }, (_, i) => {
                const [x, y] = point(burst.angle, R).split(' ').map(Number)
                const a = (i * 45 * Math.PI) / 180
                return (
                  <line
                    key={i}
                    x1={x + Math.cos(a) * 8}
                    y1={y + Math.sin(a) * 8}
                    x2={x + Math.cos(a) * 20}
                    y2={y + Math.sin(a) * 20}
                  />
                )
              })}
            </g>
          )}

          {/* centre: combo counter, feedback word, and the key to press */}
          <text className="skill-combo" x={C} y={C + 52} textAnchor="middle">
            {stage === 'done' ? PULSE.hitsNeeded : combo}
            <tspan className="skill-combo-of">/{PULSE.hitsNeeded}</tspan>
          </text>
          <text className={`skill-center fb-${feedback ?? 'none'}`} x={C} y={C - 34} textAnchor="middle">
            {centerText}
          </text>
        </svg>
        {stage === 'done' && <span className="ribbon pulse-done m-0">{doneLabel}</span>}
      </button>

      <div className="pulse-combo" aria-label={`Combo ${combo} of ${PULSE.hitsNeeded}`}>
        <span className="pulse-combo-label">Combo</span>
        {Array.from({ length: PULSE.hitsNeeded }, (_, i) => (
          <span key={i} className={`pulse-pip ${i < combo || stage === 'done' ? 'is-on' : ''}`} />
        ))}
        <span className="muted small">
          {stage === 'done' ? 'locked' : feedback === 'miss' ? 'missed, combo reset' : `${combo}/${PULSE.hitsNeeded}`}
        </span>
      </div>

      {error && (
        <p role="alert" className="stab-error m-0">
          {error}
        </p>
      )}
    </section>
  )
}

function PulseBadge({ stage, feedback }: { stage: Stage; feedback: Feedback }) {
  if (stage === 'sending')
    return (
      <span className="badge badge-ok inline-flex shrink-0 items-center gap-1.5">
        <LoaderCircle className="size-3 animate-spin" /> Locking
      </span>
    )
  if (stage === 'done') return <span className="badge badge-medium shrink-0">Locked</span>
  if (feedback === 'great') return <span className="badge badge-medium shrink-0">Great!</span>
  if (feedback === 'hit') return <span className="badge badge-ok shrink-0">Hit!</span>
  if (feedback === 'miss') return <span className="badge badge-critical shrink-0">Miss</span>
  return <span className="badge badge-high shrink-0">Out of sync</span>
}
