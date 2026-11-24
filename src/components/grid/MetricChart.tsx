import { useMemo } from 'react';
import { Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { HARD_LIMITS, METRIC_INFO, type Anomaly, type Forecast, type Metric, type SeriesPoint } from '#/lib/grid.ts';
import { fmtTime, fmtUnit } from '#/dashboard/format';

export interface MetricChartProps {
  metric: Metric;
  data: SeriesPoint[] | undefined;
  /** overview: show the max across nodes as a second, dashed line */
  showMax?: boolean;
  height?: number;
  /** anomalies to mark as dots on the line */
  anomalies?: Anomaly[];
  /** node page: draw the projected trend up to the limit */
  forecast?: Forecast;
}

const axisStyle = { fontSize: 11, fill: 'var(--muted)' };
const tooltipStyle = { background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8 };

/** Live line chart for one metric, with anomaly dots, the hard limit and (optionally) the forecast. */
export function MetricChart({ metric, data = [], showMax = true, height = 180, anomalies, forecast }: MetricChartProps) {
  const info = METRIC_INFO[metric];
  const last = data.at(-1);
  const limit = HARD_LIMITS[metric]?.max;

  // Only anomalies of this metric that fall inside the visible time window.
  const marks = useMemo(() => {
    if (!anomalies || data.length === 0) return [];
    const windowStart = data[0].t;
    return anomalies.filter((a) => a.metric === metric && Date.parse(a.ts) >= windowStart);
  }, [anomalies, data, metric]);

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <span>
          {info.label}
          {forecast && <span className="eta-chip">breach in ~{forecast.etaSeconds}s</span>}
        </span>
        <span className="mono big">{fmtUnit(metric, last?.avg)}</span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fmtTime} tick={axisStyle} minTickGap={50} />
          <YAxis tick={axisStyle} domain={['auto', 'auto']} width={50} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(t) => fmtTime(Number(t))}
            formatter={(v: number, name) => [fmtUnit(metric, v), name]}
          />

          <Line dataKey="avg" name={showMax ? 'avg' : 'value'} stroke="var(--accent)" dot={false} strokeWidth={2} isAnimationActive={false} />
          {showMax && (
            <Line dataKey="max" name="max" stroke="var(--warn)" dot={false} strokeWidth={1} strokeDasharray="4 3" isAnimationActive={false} />
          )}

          {marks.map((a) => (
            <ReferenceDot key={a.id} x={Date.parse(a.ts)} y={a.value} r={5} fill={`var(--sev-${a.severity})`} stroke="none" ifOverflow="extendDomain" />
          ))}

          {/* Hard limit: only drawn when it is in view, or when a forecast pulls it into view. */}
          {limit !== undefined && (
            <ReferenceLine y={limit} stroke="var(--sev-critical)" strokeDasharray="6 4" ifOverflow={forecast ? 'extendDomain' : 'discard'} />
          )}

          {/* Forecast: dashed line from the latest value to the limit at the predicted time. */}
          {forecast && last && (
            <ReferenceLine
              segment={[
                { x: last.t, y: last.avg },
                { x: last.t + forecast.etaSeconds * 1000, y: forecast.limit },
              ]}
              stroke="var(--text)"
              strokeWidth={2}
              strokeDasharray="2 3"
              ifOverflow="extendDomain"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
