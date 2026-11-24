import { METRIC_INFO, METRICS, type GridNode } from '#/lib/grid.ts';
import { fmt } from '#/dashboard/format';
import { useLatest, type NodeStatus } from '#/dashboard/hooks';
import { NodeLink } from './NodeLink';
import { SeverityBadge } from './SeverityBadge';

export interface NodeGridProps {
  nodes: GridNode[];
  statuses: Record<string, NodeStatus>;
}

/** One card per node with its status and latest value for every metric. */
export function NodeGrid({ nodes, statuses }: NodeGridProps) {
  const { data: latest = {} } = useLatest();

  return (
    <div className="node-grid">
      {nodes.map((n) => {
        const status = statuses[n.id] ?? 'ok';
        return (
          <NodeLink key={n.id} nodeId={n.id} className={`card node-card status-${status}`}>
            <div className="node-head">
              <span className="node-name">{n.name}</span>
              <SeverityBadge severity={status} />
            </div>
            <div className="muted small">{n.region}</div>
            <dl className="node-metrics">
              {METRICS.map((m) => (
                <div key={m}>
                  <dt>{METRIC_INFO[m].label}</dt>
                  <dd className="mono">
                    {fmt(m, latest[n.id]?.[m])}
                    <span className="muted"> {METRIC_INFO[m].unit}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </NodeLink>
        );
      })}
    </div>
  );
}
