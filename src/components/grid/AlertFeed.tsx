import type { Anomaly } from '#/lib/grid.ts';
import { ago } from '#/dashboard/format';
import { useNow } from '#/dashboard/hooks';
import { AckButton } from './AckButton';
import { NodeLink } from './NodeLink';
import { SeverityBadge } from './SeverityBadge';

export interface AlertFeedProps {
  anomalies: Anomaly[];
  /** how many open alerts to list */
  limit?: number;
}

/** List of open (not yet acknowledged) alerts, newest first. Critical ones must be stabilized (AckButton). */
export function AlertFeed({ anomalies, limit = 12 }: AlertFeedProps) {
  const now = useNow(5000);
  const open = anomalies.filter((a) => !a.acknowledgedAt);
  const shown = open.slice(0, limit);

  return (
    <div className="card feed">
      <div className="card-title">
        Open alerts <span className="muted">({open.length})</span>
      </div>
      {shown.length === 0 && <div className="muted empty">All quiet on the grid.</div>}
      <ul>
        {shown.map((a) => (
          <li key={a.id} className={`feed-item sev-${a.severity}`}>
            <div className="feed-main">
              <SeverityBadge severity={a.severity} />
              <NodeLink nodeId={a.nodeId} className="feed-node">
                {a.nodeId}
              </NodeLink>
              <span className="muted small">{ago(a.ts, now)}</span>
            </div>
            <div className="feed-msg">{a.message}</div>
            <AckButton anomaly={a} />
          </li>
        ))}
      </ul>
    </div>
  );
}
