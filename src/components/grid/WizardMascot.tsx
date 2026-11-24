/**
 * The Oracle's mascot: a small pixel-art wizard with a crystal staff, in the style of the app's
 * other pixel art. He bobs, blinks now and then, makes his orb glow and spark while the Oracle is
 * thinking, and does a little hop when an answer arrives. Animations live in grid.css (.wizard)
 * and switch off with prefers-reduced-motion.
 */

export type WizardMood = 'idle' | 'thinking' | 'speaking'

// 20 x 20 sprite. One character per pixel:
// h/H hat, S star, B brim, F/f face, E eye, W/w beard, R/r robe, G belt, T staff, O/o orb
const SPRITE = [
  '........h...........',
  '.......hH...........',
  '.......HHh..........',
  '......HHSHh.........',
  '......HHHHh.....OO..',
  '.....HHHHHHh...OoOO.',
  '.....HHHHHHHh..OOOO.',
  '...BBBBBBBBBBB..OO..',
  '.....FFFFFFf.....T..',
  '.....FEFFEFf.....T..',
  '.....FFFFFFf.....T..',
  '....WWWWWWWWw....T..',
  '....WWWWWWWWw...FT..',
  '...RWWWWWWWWwRRRFT..',
  '..RRRWWWWWWwRRR..T..',
  '..RRRRWWWWwRRRR..T..',
  '..RRRRRGGGRRRRr..T..',
  '..RRRRRRRRRRRRr..T..',
  '.rRRRRRRRRRRRRrr.T..',
  '.rrrrrrrrrrrrrr..T..',
]

const COLORS: Record<string, string> = {
  h: '#7929c6',
  H: '#3e27ab',
  S: '#e6c341',
  B: '#2b1a6e',
  F: '#f1c9a5',
  f: '#d9a57f',
  E: '#f1c9a5', // eyes are drawn on top, so they can blink
  W: '#e1e7ff',
  w: '#b9bfdc',
  R: '#a52bd9',
  r: '#6b1c8f',
  G: '#e69e41',
  T: '#8a5a2b',
  O: '#5b9bff',
  o: '#e1e7ff',
}

type Run = { x: number; y: number; w: number; color: string; orb: boolean }

/** Merge each row into runs of the same colour: far fewer rects than one per pixel. */
const RUNS: Run[] = SPRITE.flatMap((row, y) => {
  const runs: Run[] = []
  for (let x = 0; x < row.length; x++) {
    const c = row[x]
    if (c === '.') continue
    const last = runs.at(-1)
    if (last && last.x + last.w === x && row[x - 1] === c) last.w++
    else runs.push({ x, y, w: 1, color: COLORS[c], orb: c === 'O' || c === 'o' })
  }
  return runs
})

const EYES = [
  { x: 6, y: 9 },
  { x: 9, y: 9 },
]

/** Sparkle positions around the orb while thinking. */
const SPARKS = [
  { x: 14, y: 3 },
  { x: 19, y: 4 },
  { x: 18, y: 8 },
  { x: 14, y: 7 },
]

export function WizardMascot({
  size = 32,
  mood = 'idle',
  className = '',
}: {
  size?: number
  mood?: WizardMood
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={`wizard mood-${mood} ${className}`}
      shapeRendering="crispEdges"
      aria-hidden
    >
      <g className="wizard-body">
        {RUNS.filter((r) => !r.orb).map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.color} />
        ))}
        <g className="wizard-orb">
          {RUNS.filter((r) => r.orb).map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.color} />
          ))}
        </g>
        <g className="wizard-eyes">
          {EYES.map((e) => (
            <rect key={e.x} x={e.x} y={e.y} width={1} height={1} fill="#140c1c" />
          ))}
        </g>
        <g className="wizard-sparks">
          {SPARKS.map((s, i) => (
            <rect key={i} x={s.x} y={s.y} width={1} height={1} fill="#e6c341" style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </g>
      </g>
    </svg>
  )
}
