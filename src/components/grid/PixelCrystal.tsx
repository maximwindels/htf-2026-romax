/**
 * The Achrona emblem: a faceted pixel-art crystal floating inside a ring of ley lines, with the
 * grid's six towers as glowing nodes on the ring and sparkles around it. Same pixel style as the
 * map, the icons and the Oracle's wizard.
 *
 * Animations live in grid.css (.emblem): the crystal floats, the nodes pulse one after another,
 * the inner ley line flows and the sparkles twinkle. As the Desync grows (html[data-desync]) the
 * crystal turns red and glitches. Everything is still with prefers-reduced-motion.
 *
 * The name stays PixelCrystal so every place that shows the logo (sidebar, top bar, login) uses it.
 */

/** 25 x 25 pixels, centre (12, 12). */
const SIZE = 25;
const CENTER = 12;

// The crystal, 11 x 16. K outline, W shine, L light facet, P pink facet, U purple, D deep purple,
// C girdle light, B girdle blue.
const CRYSTAL = [
  ".....K.....",
  "....KWK....",
  "...KWLPK...",
  "..KWLLPUK..",
  ".KWLLPPUUK.",
  "KLLLPPPUUDK",
  "KLLPPPPUUDK",
  "KCCCCCCCBBK",
  ".KLPPPUUDK.",
  ".KLPPUUUDK.",
  "..KPPUUDK..",
  "..KPUUDDK..",
  "...KUUDK...",
  "...KUDDK...",
  "....KDK....",
  ".....K.....",
];
const CRYSTAL_X = CENTER - 5;
const CRYSTAL_Y = 4;

const COLORS: Record<string, string> = {
  K: "#0b1a4d",
  W: "#ffffff",
  L: "#e1e7ff",
  P: "#e292f4",
  U: "#a52bd9",
  D: "#5b1a8f",
  C: "#9fe4ff",
  B: "#004fe2",
};

type Pixel = { x: number; y: number };

/** Pixels of a ring of `radius` around the centre, `width` pixels thick. */
function ring(radius: number, width: number): Pixel[] {
  const pixels: Pixel[] = [];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      if (Math.abs(Math.hypot(x - CENTER, y - CENTER) - radius) < width / 2)
        pixels.push({ x, y });
  return pixels;
}

const OUTER_RING = ring(10.6, 1.25);
// Every other pixel, so the inner ley line can flow (grid.css .emblem-ley).
const INNER_RING = ring(8.4, 1).filter((p) => (p.x + p.y) % 2 === 0);

/** The six towers of the grid, on the outer ring. */
const NODES: Pixel[] = Array.from({ length: 6 }, (_, i) => {
  const angle = ((-90 + i * 60) * Math.PI) / 180;
  return {
    x: Math.round(CENTER + 10.6 * Math.cos(angle)),
    y: Math.round(CENTER + 10.6 * Math.sin(angle)),
  };
});

/** Four-point sparkles in the corners, outside the ring. */
const SPARKLES: Pixel[] = [
  { x: 2, y: 3 },
  { x: 22, y: 2 },
  { x: 22, y: 21 },
  { x: 2, y: 21 },
];

export interface PixelCrystalProps {
  size?: number;
}

export function PixelCrystal({ size = 34 }: PixelCrystalProps) {
  return (
    <svg
      className="pixel emblem"
      width={size}
      height={size}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      {/* The ley-line ring: a dark rim and a flowing inner line. */}
      <g className="emblem-ring">
        {OUTER_RING.map((p) => (
          <rect
            key={`o${p.x}-${p.y}`}
            x={p.x}
            y={p.y}
            width={1}
            height={1}
            fill="#3a4fc0"
          />
        ))}
      </g>
      <g className="emblem-ley">
        {INNER_RING.map((p) => (
          <rect
            key={`i${p.x}-${p.y}`}
            x={p.x}
            y={p.y}
            width={1}
            height={1}
            fill="#7aa6ff"
          />
        ))}
      </g>

      {/* The six towers: a gold cross with a white heart, pulsing one after another. */}
      {NODES.map((n, i) => (
        <g
          key={`n${i}`}
          className="emblem-node"
          style={{ animationDelay: `${i * 0.35}s` }}
        >
          <rect x={n.x - 1} y={n.y} width={3} height={1} fill="#e6a53c" />
          <rect x={n.x} y={n.y - 1} width={1} height={3} fill="#e6a53c" />
          <rect x={n.x} y={n.y} width={1} height={1} fill="#fff6c8" />
        </g>
      ))}

      {SPARKLES.map((s, i) => (
        <g
          key={`s${i}`}
          className="emblem-sparkle"
          style={{ animationDelay: `${i * 0.7}s` }}
        >
          <rect x={s.x - 1} y={s.y} width={3} height={1} fill="#e1e7ff" />
          <rect x={s.x} y={s.y - 1} width={1} height={3} fill="#e1e7ff" />
        </g>
      ))}

      {/* The crystal's glow on the ground; it shrinks when the crystal floats up. */}
      <g className="emblem-glow">
        <rect
          x={CENTER - 3}
          y={21}
          width={7}
          height={1}
          fill="#9fe4ff"
          opacity={0.55}
        />
        <rect
          x={CENTER - 2}
          y={22}
          width={5}
          height={1}
          fill="#9fe4ff"
          opacity={0.3}
        />
      </g>

      <g className="emblem-crystal">
        {CRYSTAL.flatMap((row, y) =>
          [...row].map((c, x) =>
            c === "." ? null : (
              <rect
                key={`c${x}-${y}`}
                x={CRYSTAL_X + x}
                y={CRYSTAL_Y + y}
                width={1}
                height={1}
                fill={COLORS[c]}
              />
            ),
          ),
        )}
        {/* A glint that runs over the shine now and then. */}
        <rect
          className="emblem-glint"
          x={CENTER - 1}
          y={CRYSTAL_Y + 3}
          width={1}
          height={2}
          fill="#ffffff"
        />
      </g>
    </svg>
  );
}
