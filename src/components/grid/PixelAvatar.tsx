/**
 * A pixel-art avatar per guardian, generated from the codename (like an identicon):
 * a symmetric 8 x 8 face in one of a few robe colours, a golden crown for commanders
 * and a helmet in their own colour for defenders. Same codename, same face, everywhere in the app.
 */
import {
  hashString,
  pixelsToPaths,
  seededRandom,
  type Pixel,
} from "./map/pixels";

const ROBES = [
  ["#a52bd9", "#5e1a80"],
  ["#3b6fd6", "#24418a"],
  ["#4f9a4a", "#2e5e33"],
  ["#c4553a", "#7e2e20"],
  ["#e69e41", "#9c6420"],
  ["#38bdf8", "#1d6fa3"],
];

export interface PixelAvatarProps {
  codename: string;
  role?: string;
  size?: number;
  className?: string;
}

export function PixelAvatar({
  codename,
  role,
  size = 32,
  className = "",
}: PixelAvatarProps) {
  const random = seededRandom(hashString(codename));
  const [robe, robeDark] = ROBES[Math.floor(random() * ROBES.length)];
  const pixels: Pixel[] = [{ x: 0, y: 0, w: 8, h: 8, color: "#140c1c" }];

  // face: left half random, mirrored to the right
  for (let y = 2; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      const inside = y >= 6 || (x >= 1 && random() < 0.75);
      if (!inside) continue;
      const color = y >= 6 ? (random() < 0.5 ? robe : robeDark) : "#e9c9a8";
      pixels.push({ x, y, color }, { x: 7 - x, y, color });
    }
  }
  // eyes
  pixels.push(
    { x: 2, y: 4, color: '#2a1838' }, { x: 5, y: 4, color: '#2a1838' },
  );

  // headwear: crown for commanders, helmet for defenders
  if (role === "commander") {
    pixels.push(
      { x: 1, y: 1, w: 6, h: 1, color: "#ffd36b" },
      { x: 1, y: 0, color: "#ffd36b" },
      { x: 3, y: 0, w: 2, h: 1, color: "#ffd36b" },
      { x: 6, y: 0, color: "#ffd36b" },
      { x: 3, y: 1, w: 2, h: 1, color: "#e292f4" },
    );
  } else {
    pixels.push(
      { x: 1, y: 1, w: 6, h: 2, color: robe },
      { x: 2, y: 0, w: 4, h: 1, color: robeDark },
      { x: 1, y: 2, w: 6, h: 1, color: robeDark },
    );
  }

  return (
    <svg
      className={`pixel-avatar ${className}`}
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`${codename} avatar`}
    >
      {pixelsToPaths(pixels).map((p) => (
        <path key={p.color} d={p.d} fill={p.color} />
      ))}
    </svg>
  );
}
