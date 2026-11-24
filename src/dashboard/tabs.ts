/**
 * The sections of the app, in one place: the sidebar and the number-key shortcuts both use this list.
 * The dashboard shows a bit of everything; every other tab shows one part in full.
 */
import type { PixelIconName } from "#/components/grid/PixelIcon";

export type TabPath =
  | "/"
  | "/map"
  | "/vitals"
  | "/nodes"
  | "/glitches"
  | "/anomalies"
  | "/leaderboard"
  | "/guardians";

export interface Tab {
  to: TabPath;
  label: string;
  icon: PixelIconName;
  /** shown only to commanders */
  commanderOnly?: boolean;
}

export const TABS: Tab[] = [
  { to: "/", label: "Dashboard", icon: "crystal" },
  { to: "/map", label: "Map", icon: "map" },
  { to: "/vitals", label: "Vitals", icon: "vitals" },
  { to: "/nodes", label: "Nodes", icon: "town" },
  { to: "/glitches", label: "Glitches", icon: "rift" },
  { to: "/anomalies", label: "Anomalies", icon: "skull" },
  { to: "/leaderboard", label: "Leaderboard", icon: "trophy" },
  { to: "/guardians", label: "Guardians", icon: "shield", commanderOnly: true },
];

/** The tabs this guardian can see, in order. Number key 1 opens the first one, 2 the second, and so on. */
export function visibleTabs(isCommander: boolean): Tab[] {
  return TABS.filter((tab) => !tab.commanderOnly || isCommander);
}
