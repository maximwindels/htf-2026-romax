/**
 * The High Council report as a PDF, in the app's "Curse of Achrona" style:
 * dark page, extruded blackletter title, parchment ribbon, gradient dividers,
 * blue KPI cards with a hard 3D edge, pixel crystal. No glows, like the app.
 */
import {
  Defs,
  Document,
  LinearGradient,
  Line,
  Page,
  Polygon,
  Polyline,
  Rect,
  Stop,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { STATUS_LABELS, type GlitchStatus } from "#/lib/glitch.ts";
import {
  HARD_LIMITS,
  METRIC_INFO,
  METRICS,
  type Metric,
  type SeriesPoint,
  type Severity,
} from "#/lib/grid.ts";
import { TREND_MINUTES, type NodeStatus, type ReportData } from "./data";
import { COLORS, FONTS, STATUS_COLORS } from "./theme";

// ---------- formatting ----------

/** The event is in Antwerp, so report times are Belgian time, whatever the server's time zone. */
const TIME_ZONE = "Europe/Brussels";
const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});
const timeOnly = new Intl.DateTimeFormat("en-GB", {
  timeStyle: "medium",
  timeZone: TIME_ZONE,
});

const fmt = (metric: Metric, v: number | undefined) =>
  v === undefined || Number.isNaN(v)
    ? "-"
    : v.toFixed(METRIC_INFO[metric].decimals);
const fmtUnit = (metric: Metric, v: number | undefined) =>
  `${fmt(metric, v)} ${METRIC_INFO[metric].unit}`;

const SEVERITY_COLORS: Record<NodeStatus, string> = {
  ok: COLORS.ok,
  medium: COLORS.medium,
  high: COLORS.high,
  critical: COLORS.critical,
};

// ---------- styles ----------

const s = StyleSheet.create({
  page: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    fontFamily: FONTS.serif,
    fontSize: 10,
    paddingTop: 34,
    paddingHorizontal: 36,
    paddingBottom: 54,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerText: { flexDirection: "column", gap: 4 },
  meta: { color: COLORS.muted, fontSize: 9.5 },
  h2: {
    fontFamily: FONTS.caps,
    fontWeight: 700,
    fontSize: 13,
    color: COLORS.orange,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  sectionNote: { color: COLORS.muted, fontSize: 9, marginBottom: 8 },
  section: { marginTop: 18 },
  summary: { fontSize: 11.5, lineHeight: 1.45, marginTop: 12 },
  bold: { fontWeight: 700 },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  kpi: {
    width: "32%",
    backgroundColor: COLORS.blue,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.edge,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  kpiLabel: {
    fontFamily: FONTS.caps,
    fontWeight: 700,
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 0.4,
  },
  kpiValue: {
    fontFamily: FONTS.label,
    fontWeight: 700,
    fontSize: 24,
    color: "#ffffff",
    marginTop: 2,
  },
  kpiSub: { fontSize: 8.5, color: "#c7cff5" },
  chips: { flexDirection: "row", gap: 8, marginTop: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.panel2,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  chipCount: { fontFamily: FONTS.label, fontWeight: 700, fontSize: 14 },
  dot: { width: 6, height: 6 }, // square = pixel, like the app's live dot
  charts: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  chartCard: {
    width: "48.6%",
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    padding: 9,
  },
  chartHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 5,
  },
  chartTitle: {
    fontFamily: FONTS.caps,
    fontWeight: 700,
    fontSize: 10,
    color: COLORS.orange,
  },
  chartValue: { fontFamily: FONTS.label, fontWeight: 700, fontSize: 12 },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
    color: COLORS.muted,
    fontSize: 7.5,
  },
  table: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    backgroundColor: COLORS.panel,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    paddingVertical: 4.5,
    alignItems: "center",
  },
  th: {
    fontFamily: FONTS.caps,
    fontWeight: 700,
    fontSize: 8.5,
    color: COLORS.orange,
  },
  td: { fontSize: 8.5, paddingRight: 6 },
  mono: { fontFamily: FONTS.mono, fontSize: 7.5 },
  badge: {
    alignSelf: "flex-start", // shrink to the label instead of filling the cell
    fontFamily: FONTS.label,
    fontWeight: 700,
    fontSize: 7.5,
    letterSpacing: 0.6,
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    color: COLORS.bg,
  },
  empty: {
    color: COLORS.muted,
    fontStyle: "italic",
    paddingVertical: 8,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    color: COLORS.muted,
    fontSize: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
});

// ---------- theme pieces ----------

/** The app's pixel-art crystal logo, one square per pixel. */
const CRYSTAL = [
  "....L....",
  "...LLP...",
  "..LLPPU..",
  ".LLPPPUU.",
  "LLPPPPUUB",
  ".PPPPUUB.",
  "..PPUUB..",
  "...UUB...",
  "....B....",
];
const CRYSTAL_COLORS: Record<string, string> = {
  L: COLORS.text,
  P: COLORS.pink,
  U: COLORS.purple,
  B: COLORS.blue,
};

function PixelCrystal({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 9 9">
      {CRYSTAL.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === "." ? null : (
            <Rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={CRYSTAL_COLORS[c]}
            />
          ),
        ),
      )}
    </Svg>
  );
}

/** Extruded blackletter: light-blue face on a solid blue 3D edge (hard offsets, no blur). */
function Extruded({ children, size }: { children: string; size: number }) {
  const layer = (offset: number, color: string) => (
    <Text
      key={offset}
      style={{
        position: "absolute",
        left: offset,
        top: offset,
        fontFamily: FONTS.display,
        fontSize: size,
        color,
      }}
    >
      {children}
    </Text>
  );
  return (
    <View style={{ position: "relative" }}>
      {layer(3, COLORS.blueDark)}
      {layer(2, COLORS.blue)}
      {layer(1, COLORS.blue)}
      <Text
        style={{
          fontFamily: FONTS.display,
          fontSize: size,
          color: COLORS.text,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

/** Parchment scroll with notched ends, like the schedule banners on the event site. */
function Ribbon({ children }: { children: string }) {
  const h = 16;
  return (
    <View style={{ flexDirection: "row", alignSelf: "flex-start" }}>
      <Svg width={7} height={h}>
        <Polygon
          points={`0,0 7,0 7,${h} 0,${h} 5,${h / 2}`}
          fill={COLORS.parchment}
        />
      </Svg>
      <View
        style={{
          height: h,
          backgroundColor: COLORS.parchment,
          justifyContent: "center",
          paddingHorizontal: 6,
        }}
      >
        <Text
          style={{
            fontFamily: FONTS.caps,
            fontWeight: 700,
            fontSize: 8.5,
            color: COLORS.parchmentInk,
            letterSpacing: 0.5,
          }}
        >
          {children}
        </Text>
      </View>
      <Svg width={7} height={h}>
        <Polygon
          points={`0,0 7,0 2,${h / 2} 7,${h} 0,${h}`}
          fill={COLORS.parchment}
        />
      </Svg>
    </View>
  );
}

/** Thin indigo > purple > orange line, the app's divider. */
function Divider({ width = 523 }: { width?: number }) {
  return (
    <Svg width={width} height={2} style={{ marginTop: 10 }}>
      <Defs>
        <LinearGradient id="divider" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={COLORS.indigo} />
          <Stop offset="0.45" stopColor={COLORS.purple} />
          <Stop offset="1" stopColor={COLORS.orange} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={2} fill="url(#divider)" />
    </Svg>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <Text style={[s.badge, { backgroundColor: color }]}>
      {label.toUpperCase()}
    </Text>
  );
}

function Section({
  title,
  note,
  children,
  breakBefore,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  breakBefore?: boolean;
}) {
  return (
    <View style={s.section} break={breakBefore}>
      <Text style={s.h2} minPresenceAhead={60}>
        {title}
      </Text>
      {note && <Text style={s.sectionNote}>{note}</Text>}
      {children}
    </View>
  );
}

// ---------- KPI cards ----------

type Tone = "normal" | "medium" | "high" | "critical";
const TONE_BG: Record<Tone, string> = {
  normal: COLORS.blue,
  medium: "#5a2bb8",
  high: COLORS.orange,
  critical: "#c0392b",
};

function Kpi({
  label,
  value,
  sub,
  tone = "normal",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}) {
  const darkText = tone === "high";
  return (
    <View style={[s.kpi, { backgroundColor: TONE_BG[tone] }]}>
      <Text style={[s.kpiLabel, darkText ? { color: COLORS.bg } : {}]}>
        {label}
      </Text>
      <Text style={[s.kpiValue, darkText ? { color: COLORS.bg } : {}]}>
        {value}
      </Text>
      {sub && (
        <Text style={[s.kpiSub, darkText ? { color: COLORS.bg } : {}]}>
          {sub}
        </Text>
      )}
    </View>
  );
}

// ---------- trend chart ----------

const CHART_W = 236;
const CHART_H = 70;

/** Min-max band plus the average line, and the hard limit when it is near the data. */
function TrendChart({
  metric,
  points,
}: {
  metric: Metric;
  points: SeriesPoint[];
}) {
  const last = points.at(-1);
  const limit = HARD_LIMITS[metric]?.max;
  const dataMax = Math.max(...points.map((p) => p.max));
  const dataMin = Math.min(...points.map((p) => p.min));
  const showLimit =
    limit !== undefined && points.length > 0 && limit <= dataMax * 1.6;
  const hi = Math.max(dataMax, showLimit ? limit : -Infinity) * 1.05;
  const lo = Math.max(0, dataMin * 0.9);
  const x = (i: number) =>
    points.length > 1 ? (i / (points.length - 1)) * CHART_W : 0;
  const y = (v: number) => CHART_H - ((v - lo) / (hi - lo || 1)) * CHART_H;

  const band = [
    ...points.map((p, i) => `${x(i)},${y(p.max)}`),
    ...points.map((p, i) => `${x(i)},${y(p.min)}`).reverse(),
  ].join(" ");
  const avgLine = points.map((p, i) => `${x(i)},${y(p.avg)}`).join(" ");

  return (
    <View style={s.chartCard} wrap={false}>
      <View style={s.chartHead}>
        <Text style={s.chartTitle}>{METRIC_INFO[metric].label}</Text>
        <Text style={s.chartValue}>avg {fmtUnit(metric, last?.avg)}</Text>
      </View>
      {points.length < 2 ? (
        <Text style={s.empty}>No readings yet.</Text>
      ) : (
        <Svg width={CHART_W} height={CHART_H}>
          <Rect
            x={0}
            y={0}
            width={CHART_W}
            height={CHART_H}
            fill={COLORS.panel2}
          />
          <Polygon points={band} fill={COLORS.blue} fillOpacity={0.35} />
          <Polyline
            points={avgLine}
            stroke={COLORS.ok}
            strokeWidth={1.4}
            fill="none"
          />
          {showLimit && (
            <Line
              x1={0}
              y1={y(limit)}
              x2={CHART_W}
              y2={y(limit)}
              stroke={COLORS.critical}
              strokeWidth={0.8}
              strokeDasharray="3 2"
            />
          )}
        </Svg>
      )}
      <View style={s.axis}>
        <Text>{points[0] ? timeOnly.format(points[0].t) : ""}</Text>
        <Text>
          {limit !== undefined
            ? `limit ${limit} ${METRIC_INFO[metric].unit}${showLimit ? " (red)" : " (off scale)"}`
            : ""}
        </Text>
        <Text>{last ? timeOnly.format(last.t) : ""}</Text>
      </View>
    </View>
  );
}

// ---------- tables ----------

interface Column<T> {
  title: string;
  width: string;
  cell: (row: T) => ReactNode;
}

function Table<T>({
  columns,
  rows,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  empty: string;
}) {
  return (
    <View style={s.table}>
      <View style={s.tr} fixed>
        {columns.map((c) => (
          <Text key={c.title} style={[s.th, { width: c.width }]}>
            {c.title}
          </Text>
        ))}
      </View>
      {rows.length === 0 && <Text style={s.empty}>{empty}</Text>}
      {rows.map((row, i) => (
        <View
          key={i}
          style={[s.tr, i === rows.length - 1 ? { borderBottomWidth: 0 } : {}]}
          wrap={false}
        >
          {columns.map((c) => (
            <View key={c.title} style={{ width: c.width }}>
              {c.cell(row)}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** One style object, as react-pdf's StyleSheet takes it. */
type PdfStyle = Parameters<typeof StyleSheet.create>[0][string]

const cellText = (text: string | number, extra: PdfStyle = {}) => (
  <Text style={[s.td, extra]}>{text}</Text>
);

// ---------- the document ----------

export function ReportDocument({ data }: { data: ReportData }) {
  const { stats, generatedAt, generatedBy } = data;
  const open = stats.openBySeverity;
  const openTotal = open.medium + open.high + open.critical;
  const openGlitches = data.glitches.filter((g) => g.status !== "FIXED").length;
  const healthTone: Tone =
    data.gridHealth < 70
      ? "critical"
      : data.gridHealth < 90
        ? "high"
        : "normal";
  const alertTone: Tone =
    open.critical > 0 ? "critical" : openTotal > 0 ? "medium" : "normal";
  const lead = stats.avgLeadSeconds;

  return (
    <Document
      title="Achrona - Report for the High Council"
      author={`Guardian ${generatedBy.codename}`}
      subject="State of the grid"
      creator="Achrona Mission Control"
    >
      <Page size="A4" style={s.page}>
        {/* ---- header ---- */}
        <View style={s.header}>
          <PixelCrystal size={54} />
          <View style={s.headerText}>
            <Ribbon>Report for the High Council of Achrona</Ribbon>
            <Extruded size={30}>State of the Grid</Extruded>
            <Text style={s.meta}>
              Generated {dateTime.format(generatedAt)} by {generatedBy.codename}{" "}
              ({generatedBy.role}) · Guardians of the Grid
            </Text>
          </View>
        </View>
        <Divider />

        {/* ---- summary ---- */}
        <Text style={s.summary}>
          The grid stands at{" "}
          <Text style={s.bold}>{data.gridHealth}% health</Text>, with{" "}
          <Text style={s.bold}>
            {openTotal} open alert{openTotal === 1 ? "" : "s"}
          </Text>{" "}
          ({open.critical} critical) and{" "}
          <Text style={s.bold}>
            {openGlitches} glitch{openGlitches === 1 ? "" : "es"}
          </Text>{" "}
          not yet fixed.{" "}
          {lead != null
            ? `Our early warnings saw limit breaches coming ${Math.round(lead)} seconds ahead on average.`
            : "No early warning was confirmed in the last hour."}
        </Text>

        <View style={s.kpis}>
          <Kpi
            label="Grid health"
            value={`${data.gridHealth}%`}
            sub={`${data.nodes.length} nodes watched`}
            tone={healthTone}
          />
          <Kpi
            label="Open alerts"
            value={String(openTotal)}
            sub={`${open.critical} critical · ${open.high} high · ${open.medium} medium`}
            tone={alertTone}
          />
          <Kpi
            label="Anomalies"
            value={String(stats.lastHour)}
            sub="in the last hour"
          />
          <Kpi
            label="Early warnings"
            value={String(stats.warningsLastHour)}
            sub={`${stats.confirmedLastHour} confirmed in the last hour`}
            tone={stats.warningsLastHour > 0 ? "medium" : "normal"}
          />
          <Kpi
            label="Avg lead time"
            value={lead != null ? `${Math.round(lead)} s` : "-"}
            sub="warning before the breach"
          />
          <Kpi
            label="Sensor readings"
            value={String(stats.readingsPerMinute)}
            sub="per minute"
          />
        </View>

        <Section title="Glitches by status">
          <View style={s.chips}>
            {(Object.keys(data.glitchesByStatus) as GlitchStatus[]).map(
              (status) => (
                <View key={status} style={s.chip}>
                  <View
                    style={[s.dot, { backgroundColor: STATUS_COLORS[status] }]}
                  />
                  <Text>{STATUS_LABELS[status]}</Text>
                  <Text style={s.chipCount}>
                    {data.glitchesByStatus[status]}
                  </Text>
                </View>
              ),
            )}
          </View>
        </Section>

        <Section
          title="Vital statistics"
          note={`Average over all nodes, last ${TREND_MINUTES} minutes. The band shows the lowest and highest node.`}
        >
          <View style={s.charts}>
            {METRICS.map((m) => (
              <TrendChart key={m} metric={m} points={data.trends[m]} />
            ))}
          </View>
        </Section>

        {/* ---- page 2+: details ---- */}
        <Section
          title="Nodes"
          note="Latest reading per node. Status = worst open alert in the last 2 minutes."
          breakBefore
        >
          <Table
            rows={data.nodes}
            empty="No nodes."
            columns={[
              {
                title: "Node",
                width: "22%",
                cell: (n) => cellText(n.name, s.bold),
              },
              {
                title: "Region",
                width: "12%",
                cell: (n) => cellText(n.region),
              },
              {
                title: "Status",
                width: "14%",
                cell: (n) => (
                  <Badge label={n.status} color={SEVERITY_COLORS[n.status]} />
                ),
              },
              ...METRICS.map((m) => ({
                title: METRIC_INFO[m].label,
                width: "13%",
                cell: (n: ReportData["nodes"][number]) =>
                  cellText(fmtUnit(m, n.latest[m])),
              })),
            ]}
          />
        </Section>

        <Section
          title="Glitch register"
          note="Every glitch reported by guardians or opened by the system ([auto]), newest first."
        >
          <Table
            rows={data.glitches}
            empty="No glitches. Achrona is calm, for now."
            columns={[
              {
                title: "ID",
                width: "11%",
                cell: (g) => <Text style={s.mono}>{g.glitchId}</Text>,
              },
              {
                title: "Status",
                width: "14%",
                cell: (g) => (
                  <Badge
                    label={STATUS_LABELS[g.status]}
                    color={STATUS_COLORS[g.status]}
                  />
                ),
              },
              {
                title: "Description",
                width: "38%",
                cell: (g) => cellText(g.description),
              },
              { title: 'Assignee', width: '12%', cell: (g) => cellText(g.assignee ?? '-') },
              {
                title: "Echoes",
                width: "8%",
                cell: (g) => cellText(g.echoCount),
              },
              {
                title: "Reported",
                width: "17%",
                cell: (g) => cellText(dateTime.format(new Date(g.timestamp))),
              },
            ]}
          />
        </Section>

        <Section
          title="Most important anomalies"
          note="Open alerts first, then by severity and time. At most 25."
        >
          <Table
            rows={data.anomalies}
            empty="No anomalies recorded."
            columns={[
              {
                title: "Time",
                width: "15%",
                cell: (a) => cellText(dateTime.format(new Date(a.ts))),
              },
              {
                title: "Severity",
                width: "12%",
                cell: (a) => (
                  <Badge
                    label={a.severity}
                    color={SEVERITY_COLORS[a.severity as Severity]}
                  />
                ),
              },
              {
                title: "Node",
                width: "15%",
                cell: (a) => cellText(nodeName(data, a.nodeId), s.bold),
              },
              {
                title: "Metric",
                width: "12%",
                cell: (a) => cellText(METRIC_INFO[a.metric].label),
              },
              {
                title: "Value",
                width: "11%",
                cell: (a) => cellText(fmtUnit(a.metric, a.value)),
              },
              {
                title: "Message",
                width: "25%",
                cell: (a) => cellText(a.message, { color: COLORS.muted }),
              },
              {
                title: "State",
                width: "10%",
                cell: (a) =>
                  cellText(a.acknowledgedAt ? "ack" : "open", {
                    color: a.acknowledgedAt ? COLORS.muted : COLORS.orange,
                  }),
              },
            ]}
          />
        </Section>

        <Section
          title="Early warnings"
          note="Trends the forecaster saw heading for a hard limit. Lead time = seconds between warning and breach."
        >
          <Table
            rows={data.warnings}
            empty="No early warnings yet."
            columns={[
              {
                title: "Time",
                width: "17%",
                cell: (w) => cellText(dateTime.format(new Date(w.ts))),
              },
              {
                title: "Node",
                width: "19%",
                cell: (w) => cellText(nodeName(data, w.nodeId), s.bold),
              },
              {
                title: "Metric",
                width: "15%",
                cell: (w) => cellText(METRIC_INFO[w.metric].label),
              },
              {
                title: "Predicted",
                width: "23%",
                cell: (w) =>
                  cellText(
                    `${fmtUnit(w.metric, w.limitValue)} in ~${Math.round(w.etaSeconds)} s`,
                  ),
              },
              {
                title: "Outcome",
                width: "26%",
                cell: (w) =>
                  cellText(
                    w.confirmedAt
                      ? `confirmed, ${Math.round(w.leadSeconds ?? 0)} s ahead`
                      : "not crossed (yet)",
                    {
                      color: w.confirmedAt ? COLORS.text : COLORS.muted,
                    },
                  ),
              },
            ]}
          />
        </Section>

        <View style={s.footer} fixed>
          <Text>Achrona · Guardians of the Grid · For the High Council</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

function nodeName(data: ReportData, nodeId: string) {
  return data.nodes.find((n) => n.id === nodeId)?.name ?? nodeId;
}
