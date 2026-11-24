import { useMutation } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { METRIC_INFO, METRICS, type Metric } from '#/lib/grid.ts';
import { api } from './api';
import { useGuardian } from './useGuardian';
import { AlertFeed } from '#/components/grid/AlertFeed';
import { EarlyWarnings } from '#/components/grid/EarlyWarnings';
import { MetricChart } from '#/components/grid/MetricChart';
import { SeverityBadge } from '#/components/grid/SeverityBadge';
import { useAnomalies, useForecasts, useNodeStatuses, useNodes, useSeries } from './hooks';

function NodeChart({ metric, nodeId }: { metric: Metric; nodeId: string }) {
  const { data } = useSeries(metric, nodeId);
  const { data: anomalies = [] } = useAnomalies();
  const { data: forecasts = [] } = useForecasts();
  return (
    <MetricChart
      metric={metric}
      data={data}
      showMax={false}
      height={200}
      anomalies={anomalies.filter((a) => a.nodeId === nodeId)}
      forecast={forecasts.find((f) => f.nodeId === nodeId && f.metric === metric)}
    />
  );
}

export function NodeDetailPage() {
  const { nodeId } = useParams({ from: '/_app/nodes/$nodeId' });
  const { data: nodes = [] } = useNodes();
  const { data: anomalies = [] } = useAnomalies();
  const { data: forecasts = [] } = useForecasts();
  const statuses = useNodeStatuses();
  const node = nodes.find((n) => n.id === nodeId);
  const [metric, setMetric] = useState<Metric>('temperature');
  // Demo buttons: commander only (admin rights), the API checks this too.
  const { canControlSimulator } = useGuardian();
  const glitch = useMutation({ mutationFn: () => api.glitch({ nodeId, metric }) });
  const ramp = useMutation({ mutationFn: () => api.ramp({ nodeId, metric }) });

  if (nodes.length && !node) return <div className="page">Unknown node. <Link to="/">Back</Link></div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link to="/" className="muted small">
            ← Mission control
          </Link>
          <h1>
            {node?.name ?? nodeId} <SeverityBadge severity={statuses[nodeId] ?? 'ok'} />
          </h1>
          <div className="muted">Region {node?.region}</div>
        </div>
        {canControlSimulator && (
        <div className="actions">
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} aria-label="Metric to disturb">
            {METRICS.map((m) => (
              <option key={m} value={m}>
                {METRIC_INFO[m].label}
              </option>
            ))}
          </select>
          <button onClick={() => ramp.mutate()} title="A slow build-up the forecaster can see coming">
            Slow build-up
          </button>
          <button className="magic" onClick={() => glitch.mutate()}>
            Sudden glitch
          </button>
        </div>
        )}
      </div>
      <section className="split">
        <div className="charts charts-2">
          {METRICS.map((m) => (
            <NodeChart key={m} metric={m} nodeId={nodeId} />
          ))}
        </div>
        <div className="stack">
          <EarlyWarnings forecasts={forecasts.filter((f) => f.nodeId === nodeId)} nodes={nodes} />
          <AlertFeed anomalies={anomalies.filter((a) => a.nodeId === nodeId)} />
        </div>
      </section>
    </div>
  );
}
