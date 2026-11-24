import { useId, useMemo } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import {
  HARD_LIMITS,
  METRIC_INFO,
  type Anomaly,
  type Forecast,
  type Metric,
  type SeriesPoint,
} from "#/lib/grid.ts";
import { fmtTime, fmtUnit } from "#/dashboard/format";
import { METRIC_ICON, PixelIcon } from "./PixelIcon";

export interface MetricChartProps {
  metric: Metric;
  data: SeriesPoint[] | undefined;
  /** overview: show the max across nodes as a second, dashed line */
  showMax?: boolean;
  height?: number;
  /** anomalies to mark on the line */
  anomalies?: Anomaly[];
  /** node page: draw the projected trend up to the limit */
  forecast?: Forecast;
}

/** One colour per metric, the same family as its pixel icon. */
const METRIC_COLOR: Record<Metric, string> = {
  load: "#7fb2ff",
  latency: "#e292f4",
  temperature: "#f0a04b",
  drift: "#38bdf8",
};

const SEVERITY_COLOR = {
  medium: "#e292f4",
  high: "#f48d30",
  critical: "#eb4c2d",
} as const;

/** The chart is a dark "scrying glass" in both themes (like the map), so its colours are fixed. */
const AXIS = {
  fontSize: 10,
  fill: "#9d9bb8",
  fontFamily: "JetBrains Mono, monospace",
};

/** How close the latest value is to the hard limit. */
function limitState(value: number | undefined, limit: number | undefined) {
  if (value === undefined || limit === undefined) return null;
  const ratio = value / limit;
  if (ratio >= 1) return { label: "Over limit", tone: "critical" };
  if (ratio >= 0.85) return { label: "Near limit", tone: "high" };
  return { label: "Stable", tone: "ok" };
}

/** Live chart for one metric: stepped pixel line, dithered area, danger zone above the limit, anomaly markers. */
export function MetricChart({
  metric,
  data = [],
  showMax = true,
  height = 180,
  anomalies,
  forecast,
}: MetricChartProps) {
  const info = METRIC_INFO[metric];
  const color = METRIC_COLOR[metric];
  const last = data.at(-1);
  const limit = HARD_LIMITS[metric]?.max;
  // SVG ids must be unique per chart and must not contain ':'
  const id = useId().replace(/:/g, "");

  // Only anomalies of this metric that fall inside the visible time window.
  const marks = useMemo(() => {
    if (!anomalies || data.length === 0) return [];
    const windowStart = data[0].t;
    return anomalies.filter(
      (a) => a.metric === metric && Date.parse(a.ts) >= windowStart,
    );
  }, [anomalies, data, metric]);

  // Window statistics for the footer, and the trend over the last ~30 readings.
  const summary = useMemo(() => {
    if (data.length === 0) return null;
    const avgs = data.map((p) => p.avg);
    const earlier = data[Math.max(0, data.length - 30)].avg;
    return {
      low: Math.min(...data.map((p) => p.min)),
      mean: avgs.reduce((sum, v) => sum + v, 0) / avgs.length,
      high: Math.max(...data.map((p) => p.max)),
      trend: (last?.avg ?? earlier) - earlier,
    };
  }, [data, last]);

  const state = limitState(last?.avg, limit);
  const rising =
    summary && Math.abs(summary.trend) > Math.abs(summary.mean) * 0.03
      ? summary.trend > 0
        ? "▲"
        : "▼"
      : "▬";

  return (
    <div className={`card chart-card scry metric-${metric}`}>
      <div className="chart-head">
        <span className="chart-title">
          <PixelIcon name={METRIC_ICON[metric]} size={27} />
          <span>
            {info.label}
            {forecast && (
              <span className="eta-chip">
                breach in ~{forecast.etaSeconds}s
              </span>
            )}
          </span>
        </span>
        <span className="chart-now">
          {summary && (
            <span className="trend" title="Trend over the last 30 readings">
              {rising}
            </span>
          )}
          <span className="big">{fmtUnit(metric, last?.avg)}</span>
        </span>
      </div>

      <div className="scope-frame">
        {state && (
          <span className={`scope-state tone-${state.tone}`}>
            {state.label}
          </span>
        )}
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, bottom: 0, left: -16 }}
          >
            <defs>
              {/* 2x2 dither: the area under the line is filled with pixels, not a smooth gradient */}
              <pattern
                id={`dither-${id}`}
                width="4"
                height="4"
                patternUnits="userSpaceOnUse"
              >
                <rect width="2" height="2" fill={color} opacity="0.45" />
                <rect
                  x="2"
                  y="2"
                  width="2"
                  height="2"
                  fill={color}
                  opacity="0.25"
                />
              </pattern>
              {/* red diagonal stripes for the zone above the hard limit */}
              <pattern
                id={`danger-${id}`}
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="3" height="6" fill="#eb4c2d" opacity="0.22" />
              </pattern>
            </defs>

            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={fmtTime}
              tick={AXIS}
              minTickGap={50}
              axisLine={{ stroke: "#3a3150" }}
              tickLine={false}
            />
            <YAxis
              tick={AXIS}
              domain={["auto", "auto"]}
              width={50}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<ScryTooltip metric={metric} />}
              cursor={{ stroke: "#e1e7ff", strokeDasharray: "2 2" }}
            />

            {limit !== undefined && (
              <ReferenceArea
                y1={limit}
                y2={limit * 2}
                fill={`url(#danger-${id})`}
                ifOverflow="hidden"
              />
            )}

            <Area
              dataKey="avg"
              name={showMax ? "avg" : "value"}
              type="stepAfter"
              stroke={color}
              strokeWidth={2}
              fill={`url(#dither-${id})`}
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 0 }}
            />
            {showMax && (
              <Line
                dataKey="max"
                name="max"
                type="stepAfter"
                stroke="#e69e41"
                dot={false}
                strokeWidth={1}
                strokeDasharray="3 3"
                isAnimationActive={false}
              />
            )}

            {marks.map((a) => (
              <ReferenceDot
                key={a.id}
                x={Date.parse(a.ts)}
                y={a.value}
                ifOverflow="extendDomain"
                shape={(props: { cx?: number; cy?: number }) => (
                  <rect
                    x={(props.cx ?? 0) - 3.5}
                    y={(props.cy ?? 0) - 3.5}
                    width={7}
                    height={7}
                    fill={SEVERITY_COLOR[a.severity]}
                    stroke="#140c1c"
                    strokeWidth={1.5}
                    shapeRendering="crispEdges"
                  />
                )}
              />
            ))}

            {/* Hard limit: only drawn when it is in view, or when a forecast pulls it into view. */}
            {limit !== undefined && (
              <ReferenceLine
                y={limit}
                stroke="#eb4c2d"
                strokeDasharray="6 4"
                ifOverflow={forecast ? "extendDomain" : "discard"}
                label={{
                  value: `limit ${limit}`,
                  position: "insideTopRight",
                  fill: "#ff8a7a",
                  fontSize: 10,
                }}
              />
            )}

            {/* Forecast: dashed line from the latest value to the limit at the predicted time. */}
            {forecast && last && (
              <ReferenceLine
                segment={[
                  { x: last.t, y: last.avg },
                  { x: last.t + forecast.etaSeconds * 1000, y: forecast.limit },
                ]}
                stroke="#e1e7ff"
                strokeWidth={2}
                strokeDasharray="2 3"
                ifOverflow="extendDomain"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {summary && (
        <div className="chart-stats">
          <span>
            <em>low</em> {fmtUnit(metric, summary.low)}
          </span>
          <span>
            <em>avg</em> {fmtUnit(metric, summary.mean)}
          </span>
          <span>
            <em>high</em> {fmtUnit(metric, summary.high)}
          </span>
          {limit !== undefined && (
            <span className="limit">
              <em>limit</em> {fmtUnit(metric, limit)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Tooltip as a small pixel panel. */
function ScryTooltip({
  active,
  payload,
  label,
  metric,
}: TooltipProps<number, string> & { metric: Metric }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="scry-tip">
      <div className="scry-tip-time">{fmtTime(Number(label))}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="scry-tip-row">
          <span>{p.name}</span>
          <strong>{fmtUnit(metric, Number(p.value))}</strong>
        </div>
      ))}
    </div>
  );
}
