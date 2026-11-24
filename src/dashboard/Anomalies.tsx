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
import { METRIC_INFO, SEVERITY_RANK, type Anomaly } from '#/lib/grid.ts';
import { NodeLink } from '#/components/grid/NodeLink';
import { SeverityBadge } from '#/components/grid/SeverityBadge';
import { fmt, fmtTime } from './format';
import { AckButton } from '#/components/grid/AckButton';
import { useAnomalies } from './hooks';

const column = createColumnHelper<Anomaly>();
const Mono = ({ children }: { children: string }) => <span className="mono">{children}</span>;

/** Anomaly log: a TanStack Table with sorting, search, a severity filter, an open-only toggle and pages. */
export function AnomaliesPage() {
  const { data = [], isLoading } = useAnomalies();
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
      column.accessor('nodeId', { header: 'Node', cell: (c) => <NodeLink nodeId={c.getValue()}>{c.getValue()}</NodeLink> }),
      column.accessor('metric', { header: 'Metric', cell: (c) => METRIC_INFO[c.getValue()].label }),
      column.accessor('value', { header: 'Value', cell: (c) => <Mono>{fmt(c.row.original.metric, c.getValue())}</Mono> }),
      column.accessor('expected', { header: 'Expected', cell: (c) => <Mono>{fmt(c.row.original.metric, c.getValue())}</Mono> }),
      column.accessor('zscore', { header: 'z', cell: (c) => <Mono>{c.getValue().toFixed(1)}</Mono> }),
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
    [],
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
          <span className="ribbon">Chronicle of glitches</span>
          <h1>Anomaly Log</h1>
        </div>
      </div>
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
