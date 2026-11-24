import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { METRIC_INFO, METRICS, SEVERITIES, SEVERITY_RANK, type Anomaly, type Severity } from '#/lib/grid.ts';
import { METRIC_ICON, PixelIcon, type PixelIconName } from '#/components/grid/PixelIcon';
import { TownScene } from '#/components/grid/NodeGrid';
import { NodeLink } from '#/components/grid/NodeLink';
import { SeverityBadge } from '#/components/grid/SeverityBadge';
import { fmt, fmtTime } from './format';
import { AckButton } from '#/components/grid/AckButton';
import { useAnomalies, useNodes } from './hooks';

const column = createColumnHelper<Anomaly>();
const Mono = ({ children }: { children: string }) => <span className="mono">{children}</span>;

/** Anomaly log: a TanStack Table with sorting, search, a severity filter, an open-only toggle and pages. */
export function AnomaliesPage() {
  const { data = [], isLoading } = useAnomalies();
  const { data: nodes = [] } = useNodes();
  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  const [sorting, setSorting] = useState<SortingState>([{ id: 'ts', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [severity, setSeverity] = useState<string>('all');
  const [onlyOpen, setOnlyOpen] = useState(true);

  // The dropdown and checkbox filter the data before it reaches the table; the search box is the table's global filter.
  const rows = useMemo(() => {
    const matchesSeverity = (a: Anomaly) => severity === 'all' || a.severity === severity;
    const matchesOpen = (a: Anomaly) => !onlyOpen || !a.acknowledgedAt;
    return data.filter((a) => matchesSeverity(a) && matchesOpen(a));
  }, [data, severity, onlyOpen]);

  const columns = useMemo(
    () => [
      column.accessor('ts', { header: 'Time', cell: (c) => <Mono>{fmtTime(c.getValue())}</Mono> }),
      column.accessor('severity', {
        header: 'Severity',
        cell: (c) => <SeverityBadge severity={c.getValue()} />,
        // sort by importance (critical > high > medium), not alphabetically
        sortingFn: (a, b) => SEVERITY_RANK[a.original.severity] - SEVERITY_RANK[b.original.severity],
      }),
      column.accessor('nodeId', {
        header: 'Node',
        cell: (c) => (
          <NodeLink nodeId={c.getValue()} className="node-cell">
            {nodeName(c.getValue())}
          </NodeLink>
        ),
      }),
      column.accessor('metric', {
        header: 'Metric',
        cell: (c) => (
          <span className="metric-cell">
            <PixelIcon name={METRIC_ICON[c.getValue()]} size={18} />
            {METRIC_INFO[c.getValue()].label}
          </span>
        ),
      }),
      column.accessor('value', { header: 'Value', cell: (c) => <Mono>{fmt(c.row.original.metric, c.getValue())}</Mono> }),
      column.accessor('expected', { header: 'Expected', cell: (c) => <Mono>{fmt(c.row.original.metric, c.getValue())}</Mono> }),
      column.accessor('zscore', { header: 'z', cell: (c) => <ZBar z={c.getValue()} /> }),
      column.accessor('message', { header: 'Message', enableSorting: false }),
      column.display({
        id: 'ack',
        header: '',
        cell: (c) => {
          const anomaly = c.row.original;
          if (anomaly.acknowledgedAt) return <span className="muted small">ack {fmtTime(anomaly.acknowledgedAt)}</span>;
          return <AckButton anomaly={anomaly} label="Ack" />;
        },
      }),
    ],
    // node names come from the node list
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
    initialState: { pagination: { pageSize: 15 } },
  });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="ribbon">Chronicle of anomalies</span>
          <h1>
            <PixelIcon name="skull" size={36} />
            Anomaly Log
          </h1>
        </div>
      </div>
      <AnomalySummary
        anomalies={data}
        nodes={nodes}
        severity={severity}
        onSeverity={(s) => setSeverity((cur) => (cur === s ? 'all' : s))}
        onMetric={(label) => setGlobalFilter((cur) => (cur === label ? '' : label))}
      />
      <div className="card">
        <div className="toolbar">
          <input placeholder="Search node, metric, message…" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} />
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
          <label className="check">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Open only
          </label>
          <span className="muted small">{table.getFilteredRowModel().rows.length} results</span>
        </div>
        {isLoading ? (
          <div className="muted empty">Loading…</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        onClick={h.column.getToggleSortingHandler()}
                        className={h.column.getCanSort() ? 'sortable' : undefined}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {{ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted() as string] ?? ''}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="table-empty">
                      <PixelIcon name="crystal" size={36} />
                      <span>{onlyOpen ? 'No open anomalies. All quiet on the grid.' : 'No anomalies match.'}</span>
                    </td>
                  </tr>
                )}
                {table.getRowModel().rows.map((r) => (
                  <tr key={r.id} className={`row-${r.original.severity}`}>
                    {r.getVisibleCells().map((c) => (
                      <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pager">
          <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            ‹ Prev
          </button>
          <span className="muted small">
            Page {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
          </span>
          <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next ›
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- summary strip ----------

const SEVERITY_ICON: Record<Severity, PixelIconName> = { critical: 'skull', high: 'temperature', medium: 'eye' };

/**
 * Above the log: open anomalies per severity (click to filter), per metric (click to search)
 * and the node with the most open anomalies right now.
 */
function AnomalySummary({
  anomalies,
  nodes,
  severity,
  onSeverity,
  onMetric,
}: {
  anomalies: Anomaly[];
  nodes: { id: string; name: string; region: string; x: number; y: number }[];
  severity: string;
  onSeverity: (s: Severity) => void;
  onMetric: (label: string) => void;
}) {
  const open = anomalies.filter((a) => !a.acknowledgedAt);
  const perNode = new Map<string, number>();
  for (const a of open) perNode.set(a.nodeId, (perNode.get(a.nodeId) ?? 0) + 1);
  const [hotId, hotCount] = [...perNode].sort((a, b) => b[1] - a[1])[0] ?? [];
  const hot = nodes.find((n) => n.id === hotId);
  const worst = (id: string): Severity =>
    open.filter((a) => a.nodeId === id).reduce<Severity>((w, a) => (SEVERITY_RANK[a.severity] > SEVERITY_RANK[w] ? a.severity : w), 'medium');

  return (
    <section className="anomaly-summary">
      <div className="sev-tiles">
        {[...SEVERITIES].reverse().map((s) => (
          <button
            key={s}
            type="button"
            className={`sev-tile sev-${s} ${severity === s ? 'is-active' : ''}`}
            aria-pressed={severity === s}
            onClick={() => onSeverity(s)}
          >
            <PixelIcon name={SEVERITY_ICON[s]} size={27} />
            <span className="sev-tile-count">{open.filter((a) => a.severity === s).length}</span>
            <span className="sev-tile-label">open {s}</span>
          </button>
        ))}
      </div>
      <div className="card metric-tally">
        <div className="card-title">Open per metric</div>
        <div className="metric-tally-list">
          {METRICS.map((m) => (
            <button key={m} type="button" className="metric-tally-item" onClick={() => onMetric(METRIC_INFO[m].label)} title={`Search ${METRIC_INFO[m].label}`}>
              <PixelIcon name={METRIC_ICON[m]} size={18} />
              <span>{METRIC_INFO[m].label}</span>
              <b>{open.filter((a) => a.metric === m).length}</b>
            </button>
          ))}
        </div>
      </div>
      <div className="card hot-node">
        <div className="card-title">Most troubled node</div>
        {hot ? (
          <NodeLink nodeId={hot.id} className="hot-node-link">
            <TownScene node={hot} status={worst(hot.id)} className="town-scene hot-scene" />
            <span>
              <span className="hot-name">{hot.name}</span>
              <span className="muted small">{hotCount} open anomal{hotCount === 1 ? 'y' : 'ies'}</span>
            </span>
          </NodeLink>
        ) : (
          <p className="muted small">No open anomalies on any node.</p>
        )}
      </div>
    </section>
  );
}

/** |z| as a small pixel bar (8 blocks up to z = 20), plus the number. */
function ZBar({ z }: { z: number }) {
  const blocks = Math.min(8, Math.round((Math.abs(z) / 20) * 8));
  return (
    <span className="zbar" title={`z = ${z.toFixed(1)}`}>
      <span className="zbar-blocks" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className={i < blocks ? 'on' : ''} />
        ))}
      </span>
      <span className="mono">{z.toFixed(1)}</span>
    </span>
  );
}
