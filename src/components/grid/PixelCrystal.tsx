/** Pixel-art crystal logo, in the spirit of the event's pixel mage and floating cubes. */

// Each letter is one pixel: L = light blue, P = pink, U = purple, B = blue, . = empty.
const CRYSTAL = [
  '....L....',
  '...LLP...',
  '..LLPPU..',
  '.LLPPPUU.',
  'LLPPPPUUB',
  '.PPPPUUB.',
  '..PPUUB..',
  '...UUB...',
  '....B....',
];
const COLORS: Record<string, string> = { L: '#e1e7ff', P: '#e292f4', U: '#a52bd9', B: '#004fe2' };

export interface PixelCrystalProps {
  size?: number;
}

export function PixelCrystal({ size = 26 }: PixelCrystalProps) {
  const pixels = CRYSTAL.flatMap((row, y) =>
    [...row].map((color, x) => ({ x, y, color })).filter((p) => p.color !== '.'),
  );
  return (
    <svg className="pixel" width={size} height={size} viewBox="0 0 9 9" aria-hidden="true">
      {pixels.map((p) => (
        <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width={1} height={1} fill={COLORS[p.color]} />
      ))}
    </svg>
  );
}
