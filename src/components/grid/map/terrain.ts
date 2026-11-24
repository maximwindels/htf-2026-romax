/**
 * The land of Achrona as pixel tiles, generated once from a fixed seed:
 * snowy mountains in the north, forests in the west, the gloom swamp in the south-west,
 * a desert in the south, a river through the middle and the sea on the east coast.
 * Map units: 200 x 140 (node coordinates x2). One tile = TILE x TILE units.
 */
import { type Pixel, seededRandom, valueNoise } from "./pixels";

export const MAP_W = 200;
export const MAP_H = 140;
const TILE = 4;
const SEED = 2026;

export type Biome =
  | "sea"
  | "shore"
  | "river"
  | "snow"
  | "mountain"
  | "swamp"
  | "desert"
  | "forest"
  | "grass";

/** Muted "old map" colours: two shades per biome, chosen by noise, so the land doesn't look flat. */
const BIOME_COLORS: Record<Biome, [string, string]> = {
  sea: ["#14304f", "#17385c"],
  shore: ["#6d6446", "#7a7050"],
  river: ["#1b4670", "#1f4f7c"],
  snow: ["#aeb6d4", "#c3c9e3"],
  mountain: ["#46425c", "#514c6a"],
  swamp: ["#2a2638", "#322c42"],
  desert: ["#86703f", "#957d48"],
  forest: ["#1d3622", "#223f27"],
  grass: ["#294a2d", "#2e5332"],
};

/** x of the river at height y: it winds from the northern mountains down to the sea. */
export function riverX(y: number) {
  return 96 + Math.sin(y / 15) * 9 + y * 0.25;
}

export function biomeAt(x: number, y: number): Biome {
  const n = valueNoise(x, y, 18, SEED);
  const n2 = valueNoise(x, y, 7, SEED + 1);

  // east coast and the south-east bay
  const coast = 176 + n * 16 - Math.max(0, y - 90) * 0.35;
  if (x > coast + 4 && y > 34) return "sea";
  if (x > coast && y > 34) return "shore";

  if (Math.abs(x - riverX(y)) < 2.6 && y < 128) return "river";

  const ridge = 26 + n * 14;
  if (y < ridge - 12) return "snow";
  if (y < ridge) return "mountain";

  if (Math.hypot(x - 44, y - 120) < 24 + n2 * 10) return "swamp";
  if (Math.hypot((x - 106) * 0.8, y - 120) < 22 + n2 * 8) return "desert";
  if (x < 70 + n * 20 && n2 > 0.42) return "forest";
  return "grass";
}

/** Decoration per biome: small pixel sprites (tree, peak, dune, reed, wave). */
function decoration(
  biome: Biome,
  x: number,
  y: number,
  random: () => number,
): Pixel[] {
  switch (biome) {
    case "forest":
      return [
        { x: x + 1, y, w: 1, h: 1, color: "#3f7a43" },
        { x, y: y + 1, w: 3, h: 1, color: "#336b38" },
        { x: x + 1, y: y + 2, w: 1, h: 1, color: "#4a2f1a" },
      ];
    case "mountain":
      return [
        { x: x + 1, y, w: 1, h: 1, color: "#d8dcef" },
        { x, y: y + 1, w: 3, h: 1, color: "#6e6889" },
        { x: x - 1, y: y + 2, w: 5, h: 1, color: "#5d5878" },
      ];
    case "snow":
      return [{ x, y: y + 1, w: 2, h: 1, color: "#e6e9f7" }];
    case "desert":
      return random() < 0.3
        ? [
            { x: x + 1, y, w: 1, h: 3, color: "#4f7a3a" }, // cactus
            { x, y: y + 1, w: 1, h: 1, color: "#4f7a3a" },
          ]
        : [{ x, y: y + 2, w: 3, h: 1, color: "#a98e55" }]; // dune
    case "swamp":
      return [
        { x, y, w: 1, h: 2, color: "#4c5a3a" },
        { x: x + 2, y: y + 1, w: 1, h: 2, color: "#4c5a3a" },
      ];
    case "grass":
      return random() < 0.5
        ? [{ x, y: y + 1, w: 1, h: 1, color: "#3b6a3f" }]
        : [];
    default:
      return [];
  }
}

export interface Terrain {
  /** the ground and its decorations, drawn once */
  land: Pixel[];
  /** light pixels on the water that shimmer (animated in CSS) */
  waves: Pixel[];
}

/**
 * Build the terrain. Decorations keep a little distance from the cities,
 * so the buildings and their names stay readable.
 */
export function buildTerrain(cities: { x: number; y: number }[]): Terrain {
  const random = seededRandom(SEED);
  const land: Pixel[] = [];
  const waves: Pixel[] = [];
  const nearCity = (x: number, y: number) =>
    cities.some((c) => Math.abs(x - c.x) < 12 && y > c.y - 16 && y < c.y + 12);

  for (let ty = 0; ty < MAP_H / TILE; ty++) {
    for (let tx = 0; tx < MAP_W / TILE; tx++) {
      const x = tx * TILE;
      const y = ty * TILE;
      const biome = biomeAt(x + TILE / 2, y + TILE / 2);
      const shade = valueNoise(x, y, 6, SEED + 2) > 0.5 ? 1 : 0;
      land.push({ x, y, w: TILE, h: TILE, color: BIOME_COLORS[biome][shade] });

      if (biome === "sea" || biome === "river") {
        if (random() < 0.35)
          waves.push({
            x: x + Math.floor(random() * 2),
            y: y + 1 + Math.floor(random() * 2),
            w: 2,
            h: 1,
            color: "#4f86b8",
          });
        continue;
      }
      if (nearCity(x, y) || random() > 0.45) continue;
      land.push(...decoration(biome, x + Math.floor(random() * 2), y, random));
    }
  }
  return { land, waves };
}
