/**
 * Small helpers for the pixel-art map: a seeded random generator, smooth value noise,
 * and a way to turn thousands of pixels into a few SVG paths (one per colour).
 * Everything is deterministic, so the server render and the browser render match.
 */

/** A pixel to draw: top-left corner, size (default 1x1) and colour. */
export interface Pixel {
  x: number;
  y: number;
  w?: number;
  h?: number;
  color: string;
}

/** Seeded random numbers in [0, 1) (mulberry32). Same seed, same sequence. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable number from a string, to seed per-node randomness ("ember-forge" -> 1234...). */
export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Random value in [0, 1) for one lattice point. */
function latticeValue(ix: number, iy: number, seed: number): number {
  let h =
    Math.imul(ix, 374761393) +
    Math.imul(iy, 668265263) +
    Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth noise in [0, 1): random values on a grid of `scale` units, blended in between. */
export function valueNoise(
  x: number,
  y: number,
  scale: number,
  seed: number,
): number {
  const gx = x / scale;
  const gy = y / scale;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top =
    latticeValue(ix, iy, seed) * (1 - sx) + latticeValue(ix + 1, iy, seed) * sx;
  const bottom =
    latticeValue(ix, iy + 1, seed) * (1 - sx) +
    latticeValue(ix + 1, iy + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}

/**
 * One SVG path per colour. Far fewer DOM nodes than one <rect> per pixel,
 * which keeps the map fast even with a few thousand terrain pixels.
 */
export function pixelsToPaths(pixels: Pixel[]): { color: string; d: string }[] {
  const byColor = new Map<string, string[]>();
  for (const p of pixels) {
    const w = p.w ?? 1;
    const h = p.h ?? 1;
    const parts = byColor.get(p.color) ?? [];
    parts.push(`M${p.x} ${p.y}h${w}v${h}h${-w}z`);
    byColor.set(p.color, parts);
  }
  return [...byColor].map(([color, parts]) => ({ color, d: parts.join("") }));
}

/**
 * Pixel art written as text: one string per row, one character per pixel.
 * `palette` maps a character to a colour; '.' (or any unknown character) is transparent.
 * Rows of equal colour are merged into wider pixels.
 */
export function spriteToPixels(
  rows: string[],
  palette: Record<string, string>,
  left: number,
  top: number,
): Pixel[] {
  const pixels: Pixel[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const color = palette[row[x]];
      let run = 1;
      while (color && row[x + run] === row[x]) run++;
      if (color) pixels.push({ x: left + x, y: top + y, w: run, color });
      x += run;
    }
  });
  return pixels;
}
