/**
 * Small pixel-art icons (9 x 8 pixels) in the same style and palette as the map's towns.
 * Characters: see PALETTE in map/sprites.ts; F/f = animated flame, * = sparkle.
 */
import type { Metric } from "#/lib/grid.ts";
import { pixelsToPaths, spriteToPixels } from "./map/pixels";
import { ANIMATED, PALETTE } from "./map/sprites";

const ICONS = {
  // grid health: the heart crystal
  crystal: [
    "....W....",
    "...WPU...",
    "..WPPUu..",
    ".WPPPUuu.",
    ".WPPPUuu.",
    "..PPPUu..",
    "...PPu...",
    "....U....",
  ],
  // early warning: the watching eye
  eye: [
    ".........",
    "..KKKKK..",
    ".KWWWWWK.",
    "KWWBBBWWK",
    "KWWBKBWWK",
    "KWWBBBWWK",
    ".KWWWWWK.",
    "..KKKKK..",
  ],
  // mana load: a mana orb on a stand
  load: [
    "...KKK...",
    "..KBBBK..",
    ".KBWBBbK.",
    ".KBBBBbK.",
    ".KBBBbbK.",
    "..KbbbK..",
    "...KKK...",
    "..KNNNK..",
  ],
  // latency: an hourglass
  latency: [
    ".KKKKKKK.",
    ".KYYYYYK.",
    "..KYYYK..",
    "...KYK...",
    "...KTK...",
    "..KTTTK..",
    ".KTTTTTK.",
    ".KKKKKKK.",
  ],
  // core temperature: a flickering flame
  temperature: [
    "....F....",
    "...FF....",
    "...FfF...",
    "..FffF.F.",
    "..FfYfFF.",
    ".FfYYYfF.",
    ".FfYYYfF.",
    "..FfffF..",
  ],
  // sync drift: two rings slipping apart
  drift: [
    ".CCC.....",
    "C...C....",
    "C..UUU...",
    "C.U.C.U..",
    ".CUC..U..",
    "..U...U..",
    "...UUU...",
    ".........",
  ],
  // open alerts: a skull
  skull: [
    "..WWWWW..",
    ".WWWWWWW.",
    ".WKKWKKW.",
    ".WKKWKKW.",
    ".WWWKWWW.",
    "..WWWWW..",
    "..W.W.W..",
    ".........",
  ],
  // nodes: a small house
  town: [
    "....R....",
    "...RRR...",
    "..RRRRr..",
    ".RRRRRRr.",
    "..NWNNN..",
    "..NWNnN..",
    "..NNNnN..",
    ".KKKKKKK.",
  ],
  // glitches: a tear in the weave of magic
  rift: ['...UU....', '..UPPU...', '.UP*.PU..', '.UP..PU..', '..UP.PU..', '...UPU...', '....U....', '.........'],
  // tab: the map of Achrona, a folded parchment
  map: ['.TTtTTtT.', '.TGGtCCt.', '.TGTtCTt.', '.TtTtTTt.', '.TTtGGtT.', '.TTtGTtT.', '.TTtTTtT.', '.........'],
  // tab: vital statistics, a heartbeat on a screen
  vitals: ['KKKKKKKKK', 'KbbbbbbbK', 'KbbbbPbbK', 'KbbbPbPbK', 'KPPPbbbPK', 'KbbbbbbbK', 'KKKKKKKKK', '.........'],
  // tab: leaderboard, a golden cup
  trophy: ['.YYYYYYY.', 'YYYYYYYYY', '.YYYYYYY.', '..YYYYY..', '...YYY...', '....Y....', '..TTTTT..', '.........'],
  // tab: guardians, a shield
  shield: ['.SSSSSSS.', '.SBBSBBS.', '.SBBSBBs.', '.SSSSSSs.', '..SBBBs..', '...SBs...', '....s....', '.........'],
} satisfies Record<string, string[]>;

export type PixelIconName = keyof typeof ICONS;

/** The icon that belongs to each metric. */
export const METRIC_ICON: Record<Metric, PixelIconName> = {
  load: "load",
  latency: "latency",
  temperature: "temperature",
  drift: "drift",
};

export interface PixelIconProps {
  name: PixelIconName;
  /** rendered size in CSS pixels (width); keep it a multiple of 9 for the crispest pixels */
  size?: number;
  className?: string;
}

export function PixelIcon({ name, size = 27, className = "" }: PixelIconProps) {
  const rows = ICONS[name];
  const still = pixelsToPaths(spriteToPixels(rows, PALETTE, 0, 0));
  const animated = Object.entries(ANIMATED)
    .map(([char, { color, className: cls }]) => ({
      cls,
      paths: pixelsToPaths(spriteToPixels(rows, { [char]: color }, 0, 0)),
    }))
    .filter((layer) => layer.paths.length > 0);

  return (
    <svg
      className={`pixel-icon ${className}`}
      width={size}
      height={(size * 8) / 9}
      viewBox="0 0 9 8"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {still.map((p) => (
        <path key={p.color} d={p.d} fill={p.color} />
      ))}
      {animated.map((layer) => (
        <g key={layer.cls} className={layer.cls}>
          {layer.paths.map((p) => (
            <path key={p.color} d={p.d} fill={p.color} />
          ))}
        </g>
      ))}
    </svg>
  );
}
