import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import {
  HARD_LIMITS,
  METRIC_INFO,
  type Metric,
  type SeriesPoint,
} from "#/lib/grid.ts";
import { fmtUnit } from "#/dashboard/format";
import { METRIC_COLOR } from "./MetricChart";
import { METRIC_ICON, PixelIcon } from "./PixelIcon";

export interface MiniVitalProps {
  metric: Metric;
  data: SeriesPoint[] | undefined;
}

/**
 * Small version of a metric chart for the dashboard: icon, live value, trend and a sparkline
 * in the same pixel style. Clicking it opens the Vitals tab with the full charts.
 */
export function MiniVital({ metric, data = [] }: MiniVitalProps) {
  const id = useId().replace(/:/g, "");
  const color = METRIC_COLOR[metric];
  const last = data.at(-1);
  const earlier = data[Math.max(0, data.length - 30)];
  const limit = HARD_LIMITS[metric]?.max;
  const ratio = last && limit ? last.avg / limit : 0;
  const tone = ratio >= 1 ? "critical" : ratio >= 0.85 ? "high" : "ok";
  const trend = last && earlier ? last.avg - earlier.avg : 0;
  const arrow =
    Math.abs(trend) > Math.abs(last?.avg ?? 0) * 0.03
      ? trend > 0
        ? "▲"
        : "▼"
      : "▬";

  return (
    <Link
      to="/vitals"
      className={`card mini-vital chart-card metric-${metric} tone-${tone}`}
      title={`${METRIC_INFO[metric].label}: open the full chart`}
    >
      <div className="mini-head">
        <span className="mini-label">
          <PixelIcon name={METRIC_ICON[metric]} size={18} />
          {METRIC_INFO[metric].label}
        </span>
        <span className="mini-value">
          {last && <span className="trend">{arrow}</span>}
          {fmtUnit(metric, last?.avg)}
        </span>
      </div>
      <div className="scope-frame mini-scope">
        <ResponsiveContainer width="100%" height={52}>
          <AreaChart
            data={data}
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          >
            <defs>
              <pattern
                id={`mini-dither-${id}`}
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
            </defs>
            <YAxis hide domain={["auto", "auto"]} />
            <Area
              dataKey="avg"
              type="stepAfter"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#mini-dither-${id})`}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Link>
  );
}
