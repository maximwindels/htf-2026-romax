/**
 * The "Curse of Achrona" theme for the PDF: the same colours and fonts as src/grid.css.
 * react-pdf can't read CSS, so the values are repeated here.
 */
import { join } from "node:path";
import { Font } from "@react-pdf/renderer";

export const COLORS = {
  bg: "#160f1f",
  panel: "#1e1530",
  panel2: "#241a38",
  line: "#3a3150",
  text: "#e1e7ff",
  muted: "#9d9bb8",
  blue: "#004fe2",
  blueDark: "#01296a",
  edge: "#00163f",
  indigo: "#3e27ab",
  orange: "#e69e41",
  orangeDark: "#d2573b",
  purple: "#a52bd9",
  pink: "#e292f4",
  parchment: "#ecdcb8",
  parchmentInk: "#3a2410",
  ok: "#5b9bff",
  medium: "#e292f4",
  high: "#f48d30",
  critical: "#eb4c2d",
} as const;

/** Glitch status colours, matching the status badges in the app. */
export const STATUS_COLORS = {
  LEAKED: "#f87171",
  ASSESSING: "#fbbf24",
  CONTAINING: "#38bdf8",
  FIXED: "#34d399",
} as const;

export const FONTS = {
  display: "Pirata One",
  serif: "Alegreya",
  caps: "Alegreya SC",
  label: "Barlow Condensed",
  mono: "JetBrains Mono",
} as const;

/** Font files come from the @fontsource packages (same fonts the app loads from Google Fonts). */
const fontFile = (pkg: string, file: string) =>
  join(process.cwd(), "node_modules", "@fontsource", pkg, "files", file);

let registered = false;

export function registerFonts() {
  if (registered) return;
  registered = true;
  Font.register({
    family: FONTS.display,
    src: fontFile("pirata-one", "pirata-one-latin-400-normal.woff"),
  });
  Font.register({
    family: FONTS.serif,
    fonts: [
      {
        src: fontFile("alegreya", "alegreya-latin-400-normal.woff"),
        fontWeight: 400,
      },
      {
        src: fontFile("alegreya", "alegreya-latin-400-italic.woff"),
        fontWeight: 400,
        fontStyle: "italic",
      },
      {
        src: fontFile("alegreya", "alegreya-latin-700-normal.woff"),
        fontWeight: 700,
      },
    ],
  });
  Font.register({
    family: FONTS.caps,
    fonts: [
      {
        src: fontFile("alegreya-sc", "alegreya-sc-latin-500-normal.woff"),
        fontWeight: 500,
      },
      {
        src: fontFile("alegreya-sc", "alegreya-sc-latin-700-normal.woff"),
        fontWeight: 700,
      },
    ],
  });
  Font.register({
    family: FONTS.label,
    fonts: [
      {
        src: fontFile(
          "barlow-condensed",
          "barlow-condensed-latin-600-normal.woff",
        ),
        fontWeight: 600,
      },
      {
        src: fontFile(
          "barlow-condensed",
          "barlow-condensed-latin-700-normal.woff",
        ),
        fontWeight: 700,
      },
    ],
  });
  Font.register({
    family: FONTS.mono,
    src: fontFile("jetbrains-mono", "jetbrains-mono-latin-400-normal.woff"),
  });
  // Never split words with hyphens: node names and ids must stay readable.
  Font.registerHyphenationCallback((word) => [word]);
}
