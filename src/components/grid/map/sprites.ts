/**
 * Pixel-art buildings, one per city. Each row is one line of pixels, each character one pixel.
 * Static colours: see PALETTE. Animated pixels use their own characters (see ANIMATED):
 *   F f = flame (flickers), * = sparkle (twinkles), Z = lightning (flashes), ~ = water (shimmers).
 */
import { type Pixel, spriteToPixels } from "./pixels";

export const PALETTE: Record<string, string> = {
  K: "#140c1c", // outline / ground shadow
  S: "#9a9fb8", // stone
  s: "#666a84", // stone, shaded side
  W: "#e1e7ff", // light (windows, snow, moon)
  B: "#3b6fd6", // blue
  b: "#24418a", // blue, shaded
  R: "#c4553a", // roof brick
  r: "#7e2e20", // roof brick, shaded
  O: "#e69e41", // orange
  Y: "#ffd36b", // gold
  P: "#e292f4", // crystal pink
  U: "#a52bd9", // purple
  u: "#5e1a80", // purple, shaded
  G: "#4f9a4a", // leaf green
  g: "#2e5e33", // leaf green, shaded
  N: "#8b5a2b", // wood
  n: "#57381b", // wood, shaded
  C: "#38bdf8", // water
  c: "#1d6fa3", // water, shaded
  T: "#d6be84", // sandstone
  t: "#9c8655", // sandstone, shaded
};

export const ANIMATED: Record<string, { color: string; className: string }> = {
  F: { color: "#e69e41", className: "px-fire" },
  f: { color: "#ffd36b", className: "px-fire px-fire-2" },
  "*": { color: "#ffffff", className: "px-sparkle" },
  Z: { color: "#ffe066", className: "px-bolt" },
  "~": { color: "#7fd3ff", className: "px-shimmer" },
};

/** Building per city id. All are 14 pixels wide; their bottom row is the ground line. */
export const BUILDINGS: Record<string, string[]> = {
  // a tall wizard tower with a blue cone roof
  "aether-spire": [
    "......*.......",
    "......BB......",
    ".....BBBb.....",
    ".....BBBb.....",
    "....BBBBbb....",
    "....BBBBbb....",
    "...KSSSSssK...",
    "....SWSSsS....",
    "....SSSSss....",
    "....SSWSss....",
    "....SSSSss....",
    "...SSSSSsss...",
    "...SSSnnsss...",
    "..SSSSnnssss..",
    "..KKKKKKKKKK..",
  ],
  // a domed treasury with glowing runes
  "runic-vault": [
    "......YY......",
    ".....UUUU.....",
    "....UUUUuu....",
    "...UUUUUuuu...",
    "..KSSSSSSssK..",
    "..SPSSPSSPsS..",
    "..SSSSSSSSsS..",
    "..SPSSPSSPsS..",
    "..SSSSnnSSsS..",
    "..SSSSnnSSsS..",
    ".SSSSSnnSSSss.",
    ".KKKKKKKKKKKK.",
  ],
  // a smithy with a fiery chimney and a glowing furnace mouth
  "ember-forge": [
    ".........fF...",
    "........FfF...",
    ".........F....",
    "........KsK...",
    "........SsS...",
    "..RRRRRRSsS...",
    ".RRRRRRRRRRr..",
    "RRRRRRRRRRRRr.",
    ".NNNNNNNNNNn..",
    ".NFfNNNNNNNn..",
    ".NfFNNKKNNNn..",
    ".NFfNNKKNNNn..",
    ".NNNNNNNNNNn..",
    "KKKKKKKKKKKKK.",
  ],
  // a stone well under a crescent moon
  "moon-well": [
    "..WW..........",
    ".WW...........",
    ".WW......*....",
    "..WW..........",
    "..............",
    "....NNNNNN....",
    "....N....n....",
    "....N....n....",
    "...KSSSSSSK...",
    "...S~CCCCCs...",
    "...SSCC~CSs...",
    "...SSSSSSSs...",
    "...KKKKKKKK...",
  ],
  // the great crystal at the heart of the grid
  "crystal-core": [
    "......W*......",
    ".....WPPU.....",
    ".....WPPU.....",
    "....WPPPUu....",
    "....WPPPUu....",
    "...WPPPPUuu...",
    "...WPPPPUuu...",
    "....PPPPUu....",
    "....PPPUUu....",
    ".....PPUu.....",
    "...SSPPUuss...",
    "..SSSSSSSsss..",
    "..KKKKKKKKKK..",
  ],
  // a lattice mast that catches lightning
  "storm-relay": [
    ".......Z......",
    "......ZZ......",
    ".....ZZ.......",
    "......ZZ......",
    ".......K......",
    "......KSK.....",
    "......SBs.....",
    ".....SSBss....",
    ".....S.B.s....",
    "....SS.B.ss...",
    "....S..B..s...",
    "...SS..B..ss..",
    "...SBBBBBBBs..",
    "..KKKKKKKKKKK.",
  ],
  // a twisted purple tree next to a crooked hut
  "gloom-hollow": [
    "...uuu........",
    "..uggUu.......",
    ".uggUggu......",
    ".ugggggu......",
    "..uggggu......",
    "....nn...RR...",
    "....nn..RRRr..",
    "....nn.RRRRRr.",
    "....nn..NNNn..",
    "...nnnn.NFNn..",
    "..nn..nnNfNn..",
    ".KKKKKKKKKKKK.",
  ],
  // a sandstone obelisk with the sun above it
  "sun-obelisk": [
    "......Y.......",
    "....Y.Y.Y.....",
    ".....YOY......",
    "...YYOOOYY....",
    ".....YOY......",
    "....Y.Y.Y.....",
    "......T.......",
    ".....TTt......",
    ".....TTt......",
    ".....TTt......",
    ".....TTt......",
    "....TTTtt.....",
    "...TTTTTtt....",
    "..KKKKKKKKK...",
  ],
  // a sea gate: a stone arch standing in the water
  "tide-gate": [
    "..SS......SS..",
    "..SSs....SSs..",
    "..SSSSSSSSSs..",
    "..SKSSSSSSKs..",
    "..SS......Ss..",
    "..SS......Ss..",
    "..SS......Ss..",
    "..SS.~CC~.Ss..",
    ".CSSCCCCCCSsC.",
    "CCSSc~CcCCSsCC",
    "CCCCCCCcC~CCCC",
  ],
  // a weaver's house between green trees
  "verdant-loom": [
    ".GG.......GG..",
    "GGGg.....GGGg.",
    "GgGg.GGGGgGgG.",
    ".n..GGGGGGgn..",
    ".n.GGGGGGGGg..",
    "...NNNNNNNNn..",
    "...NWWNNWWNn..",
    "...NNNNNNNNn..",
    "...NNNnnNNNn..",
    "...NNNnnNNNn..",
    "..KKKKKKKKKKK.",
  ],
};

/** Fallback for a city without its own drawing (e.g. real challenge data with other node ids). */
const GENERIC = [
  "....RRRR....",
  "...RRRRRr...",
  "..RRRRRRRr..",
  "...NWNNWn...",
  "...NNNNNn...",
  "...NNnnNn...",
  "..KKKKKKKK..",
];

/** A tiny house, placed around each city so it looks like a town. */
export const HUT = [".Rr.", "RRRr", "NWNn", "NNnn"];

export interface SpriteLayers {
  /** static pixels */
  pixels: Pixel[];
  /** animated pixels, grouped by CSS class */
  animated: { className: string; pixels: Pixel[] }[];
  width: number;
  height: number;
}

/** The building of one city, positioned so its ground line sits at (cx, groundY). */
export function buildingLayers(
  cityId: string,
  cx: number,
  groundY: number,
): SpriteLayers {
  const rows = BUILDINGS[cityId] ?? GENERIC;
  const width = Math.max(...rows.map((r) => r.length));
  const height = rows.length;
  const left = Math.round(cx - width / 2);
  const top = groundY - height + 1;

  const pixels = spriteToPixels(rows, PALETTE, left, top);
  const animated = Object.entries(ANIMATED).map(
    ([char, { color, className }]) => ({
      className,
      pixels: spriteToPixels(rows, { [char]: color }, left, top),
    }),
  );
  return {
    pixels,
    animated: animated.filter((a) => a.pixels.length > 0),
    width,
    height,
  };
}
