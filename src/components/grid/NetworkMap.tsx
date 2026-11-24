import { useMemo } from 'react';
import type { Forecast, GridNode } from '#/lib/grid.ts';
import type { NodeStatus } from '#/dashboard/hooks';
import { NodeLink } from './NodeLink';

export interface NetworkMapProps {
  nodes: GridNode[];
  statuses: Record<string, NodeStatus>;
  /** nodes with an active forecast are drawn as "watched" (white) */
  forecasts?: Forecast[];
}

/** Connect every node to its 2 nearest neighbours (each pair only once). */
function nearestLinks(nodes: GridNode[]): [GridNode, GridNode][] {
  const distance = (a: GridNode, b: GridNode) => Math.hypot(a.x - b.x, a.y - b.y);
  const seen = new Set<string>();
  const links: [GridNode, GridNode][] = [];

  for (const node of nodes) {
    const nearest = nodes
      .filter((other) => other.id !== node.id)
      .sort((a, b) => distance(node, a) - distance(node, b))
      .slice(0, 2);
    for (const other of nearest) {
      const pairKey = [node.id, other.id].sort().join('|');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      links.push([node, other]);
    }
  }
  return links;
}

/** The ley-line map: pixel nodes coloured by status; a link turns into a moving dashed line when both ends are in trouble. */
export function NetworkMap({ nodes, statuses, forecasts = [] }: NetworkMapProps) {
  const links = useMemo(() => nearestLinks(nodes), [nodes]);
  const watched = new Set(forecasts.map((f) => f.nodeId));

  const statusOf = (id: string) => statuses[id] ?? 'ok';
  // A healthy node with an active forecast is shown as "forecast" (watched).
  const displayStatus = (id: string) => (statusOf(id) === 'ok' && watched.has(id) ? 'forecast' : statusOf(id));

  return (
    <div className="card map-card">
      <div className="card-title">Ley-line network</div>
      <svg viewBox="0 0 100 70" className="map">
        {links.map(([a, b]) => {
          const bothInTrouble = statusOf(a.id) !== 'ok' && statusOf(b.id) !== 'ok';
          return <line key={a.id + b.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={bothInTrouble ? 'link link-bad' : 'link'} />;
        })}

        {nodes.map((n) => {
          const status = displayStatus(n.id);
          return (
            <NodeLink key={n.id} nodeId={n.id}>
              <g className={`map-node status-${status}`}>
                {status !== 'ok' && <rect x={n.x - 2.75} y={n.y - 2.75} width={5.5} height={5.5} className="pulse" />}
                {/* pixel node: dark offset edge + square face */}
                <rect x={n.x - 1.1} y={n.y - 1.1} width={3} height={3} className="dot-edge" />
                <rect x={n.x - 1.5} y={n.y - 1.5} width={3} height={3} className="dot" />
                <text x={n.x} y={n.y + 6} textAnchor="middle">
                  {n.name}
                </text>
              </g>
            </NodeLink>
          );
        })}
      </svg>
    </div>
  );
}
