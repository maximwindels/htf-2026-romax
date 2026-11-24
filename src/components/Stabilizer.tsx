import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Activity, LoaderCircle } from 'lucide-react'
import { playStabilized } from '#/dashboard/sound.ts'
import {
  FREQUENCY,
  HOLD_MS,
  PHASE,
  START_SIGNAL,
  isInTune,
  phaseDistance,
  signalError,
  targetSignal,
  type Signal,
} from '#/lib/stabilize.ts'

const W = 600
const H = 160
const MID = H / 2
const AMPLITUDE = 52
const POINTS = 120

type Stage = 'tuning' | 'sending' | 'done'

// Magnetic snap: once a slider is within tolerance, it locks onto the exact target value.
const snapFrequency = (value: number, target: number) =>
  Math.abs(value - target) <= FREQUENCY.tolerance ? target : value
const snapPhase = (value: number, target: number) =>
  phaseDistance(value, target) <= PHASE.tolerance ? target : value

/**
 * Builds an SVG path for a sine wave. `wobble` (px) adds a smooth, slowly moving distortion
 * to show instability: smooth in both x and time, so the line wobbles instead of flickering.
 */
function wavePath(signal: Signal, scroll: number, wobble: number, time: number) {
  let d = ''
  for (let i = 0; i <= POINTS; i++) {
    const x = (i / POINTS) * W
    const angle = 2 * Math.PI * signal.frequency * (x / W) + (signal.phase * Math.PI) / 180 + scroll
    const distortion = wobble
      ? wobble * (0.6 * Math.sin(x * 0.045 + time * 2.2) + 0.4 * Math.sin(x * 0.11 - time * 3.1))
      : 0
    const y = MID - AMPLITUDE * Math.sin(angle) + distortion
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  }
  return d
}

type StabilizerProps = {
  /** Picks the target signal: a glitch id, or anomalySeed(id) for a grid anomaly. */
  seed: string
  /** Sends the tuned signal to the server, which re-checks it. Throw to show an error. */
  onStabilize: (signal: Signal) => Promise<unknown>
  /** Runs a moment after success, once the success state has been seen. */
  onDone?: () => void
  doneLabel?: string
  hint?: ReactNode
  /** Focus the first slider on mount (used in the anomaly dialog). */
  autoFocus?: boolean
}

/** Mini-game: match frequency and phase to the target signal and hold it for 2 seconds. */
export function Stabilizer({
  seed,
  onStabilize,
  onDone,
  doneLabel = 'Signal stabilized',
  hint,
  autoFocus,
}: StabilizerProps) {
  const target = targetSignal(seed)

  const [signal, setSignal] = useState<Signal>(START_SIGNAL)
  const [inTune, setInTune] = useState(false)
  const [stage, setStage] = useState<Stage>('tuning')
  const [error, setError] = useState<string | null>(null)

  // The animation loop reads these refs, so it never needs to restart.
  const signalRef = useRef(signal)
  const stageRef = useRef<Stage>('tuning')
  const progressRef = useRef(0)
  const targetPathRef = useRef<SVGPathElement>(null)
  const currentPathRef = useRef<SVGPathElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  signalRef.current = signal
  stageRef.current = stage

  async function submit() {
    // Set the ref right away, so the next animation frame doesn't submit a second time.
    stageRef.current = 'sending'
    setStage('sending')
    setError(null)
    try {
      await onStabilize(signalRef.current)
      setStage('done')
      playStabilized()
      // Let the success state land before the caller moves on.
      if (onDone) setTimeout(onDone, 1600)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stabilization failed')
      progressRef.current = 0
      setStage('tuning')
    }
  }
  const submitRef = useRef(submit)
  submitRef.current = submit

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let last = performance.now()
    let wasInTune = false

    const tick = (now: number) => {
      const dt = now - last
      last = now
      const current = signalRef.current
      const tuned = isInTune(current, target)
      const done = stageRef.current !== 'tuning'

      if (tuned !== wasInTune) {
        wasInTune = tuned
        setInTune(tuned)
      }

      // Fill while in tune, drain twice as fast when the signal slips.
      if (!done) {
        const delta = tuned ? dt / HOLD_MS : -dt / (HOLD_MS / 2)
        progressRef.current = Math.min(1, Math.max(0, progressRef.current + delta))
        if (progressRef.current >= 1) submitRef.current()
      }

      const time = reduceMotion ? 0 : now / 1000
      const scroll = time * 2.5
      // Calmer the closer you get; perfectly clean once in tune.
      const wobble = done || tuned ? 0 : signalError(current, target) * 36
      targetPathRef.current?.setAttribute('d', wavePath(target, scroll, 0, time))
      currentPathRef.current?.setAttribute('d', wavePath(current, scroll, wobble, time))
      if (barRef.current) barRef.current.style.width = `${(done ? 1 : progressRef.current) * 100}%`

      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // target is derived from seed, so that is the only real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  useEffect(() => {
    if (autoFocus) document.querySelector<HTMLElement>('[data-stabilizer-start]')?.focus()
  }, [autoFocus])

  const locked = stage !== 'tuning'
  const state = stage === 'done' ? 'is-done' : inTune ? 'is-tuned' : ''

  return (
    // grid-ui + stabilizer classes: themed in src/grid.css, so it follows light and dark mode.
    <section className={`grid-ui stabilizer ${state}`}>
      <div className="stabilizer-head">
        <div>
          <h2 className="stabilizer-title m-0 border-0 p-0">
            <Activity className="size-5" />
            Stabilize the frequency
          </h2>
          <p className="stabilizer-hint m-0">
            {hint ?? 'Tune your signal onto the ghost wave and hold it steady for 2 seconds.'}
          </p>
        </div>
        <StatusBadge stage={stage} inTune={inTune} />
      </div>

      <div className="scope">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
          {[0.25, 0.75].map((f) => (
            <line key={f} className="grid-line" x1="0" x2={W} y1={H * f} y2={H * f} />
          ))}
          <line className="axis" x1="0" x2={W} y1={MID} y2={MID} />
          <path ref={targetPathRef} className="target" />
          <path ref={currentPathRef} className="signal" />
        </svg>
        {stage === 'done' && (
          <div className="scope-done">
            <span className="ribbon m-0">{doneLabel}</span>
          </div>
        )}
      </div>

      <div className="stab-meter" role="progressbar" aria-label="Stabilization">
        <span ref={barRef} />
      </div>

      <div className="stab-sliders">
        <Slider
          label="Frequency"
          unit="Hz"
          value={signal.frequency}
          display={signal.frequency.toFixed(2)}
          {...FREQUENCY}
          disabled={locked}
          first
          onChange={(frequency) =>
            setSignal((s) => ({ ...s, frequency: snapFrequency(frequency, target.frequency) }))
          }
        />
        <Slider
          label="Phase"
          unit="°"
          value={signal.phase}
          display={String(Math.round(signal.phase))}
          {...PHASE}
          disabled={locked}
          onChange={(phase) => setSignal((s) => ({ ...s, phase: snapPhase(phase, target.phase) }))}
        />
      </div>

      {error && (
        <p role="alert" className="stab-error m-0">
          {error}
        </p>
      )}
    </section>
  )
}

/** Pixel tag in the theme's badge style (grid.css .badge). */
function StatusBadge({ stage, inTune }: { stage: Stage; inTune: boolean }) {
  if (stage === 'sending')
    return (
      <span className="badge badge-ok inline-flex shrink-0 items-center gap-1.5">
        <LoaderCircle className="size-3 animate-spin" /> Locking
      </span>
    )
  if (stage === 'done') return <span className="badge badge-medium shrink-0">Stable</span>
  return inTune ? (
    <span className="badge badge-ok shrink-0">In tune · hold it</span>
  ) : (
    <span className="badge badge-critical shrink-0">Desynced</span>
  )
}

type SliderProps = {
  label: string
  unit: string
  value: number
  display: string
  min: number
  max: number
  step: number
  disabled: boolean
  /** Marks the slider the S shortcut focuses. */
  first?: boolean
  onChange: (value: number) => void
}

function Slider({ label, unit, value, display, min, max, step, disabled, first, onChange }: SliderProps) {
  return (
    <label className="stab-slider">
      <span className="stab-slider-head">
        <span className="stab-slider-label">{label}</span>
        <span className="stab-slider-value">
          {display}
          <small>{unit}</small>
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        data-stabilizer-start={first || undefined}
        onChange={(e) => onChange(Number(e.target.value))}
        className="disabled:opacity-50"
      />
    </label>
  )
}
