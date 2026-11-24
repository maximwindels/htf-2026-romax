import { METRIC_INFO, type Forecast, type GridNode } from '#/lib/grid.ts';
import { fmt } from '#/dashboard/format';
import { useStats } from '#/dashboard/hooks';
import { NodeLink } from './NodeLink';
import { SeverityBadge } from './SeverityBadge';

export interface EarlyWarningsProps {
  forecasts: Forecast[];
  nodes: GridNode[];
}

/** Trends heading for a hard limit (soonest first), plus last-hour stats and the average lead time. */
export function EarlyWarnings({ forecasts, nodes }: EarlyWarningsProps) {
  const { data: stats } = useStats();
  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  const avgLead = stats?.avgLeadSeconds;

  return (
    <div className="card warnings">
      <div className="card-title">
        Early warnings <span className="muted">({forecasts.length})</span>
      </div>

      {forecasts.length === 0 ? (
        <div className="muted empty">No threats on the horizon.</div>
      ) : (
        <ul>
          {forecasts.map((f) => (
            <WarningItem key={`${f.nodeId}:${f.metric}`} forecast={f} nodeName={nodeName(f.nodeId)} />
          ))}
        </ul>
      )}

      <div className="warnings-foot small muted">
        Last hour: {stats?.warningsLastHour ?? 0} warnings · {stats?.confirmedLastHour ?? 0} confirmed
        {avgLead != null && <> · avg {Math.round(avgLead)}s ahead</>}
      </div>
    </div>
  );
}

interface WarningItemProps {
  forecast: Forecast;
  nodeName: string;
}

function WarningItem({ forecast: f, nodeName }: WarningItemProps) {
  const { label, unit } = METRIC_INFO[f.metric];
  const percentOfLimit = Math.min(100, Math.max(0, (f.value / f.limit) * 100));

  return (
    <li className="warning-item">
      <div className="feed-main">
        <SeverityBadge severity="warning" />
        <NodeLink nodeId={f.nodeId} className="feed-node">
          {nodeName}
        </NodeLink>
        <span className="eta">~{f.etaSeconds}s</span>
      </div>
      <div className="feed-msg">
        {label} {fmt(f.metric, f.value)} → limit {f.limit} {unit} · +{f.slope} {unit}/s · fit {Math.round(f.confidence * 100)}%
      </div>
      <div className="meter" aria-hidden="true">
        <span style={{ width: `${percentOfLimit}%` }} />
      </div>
    </li>
  );
}
