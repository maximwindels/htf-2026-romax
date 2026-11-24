import { useMutation } from "@tanstack/react-query";
import { METRICS, type Latest, type Metric, type Stats } from "#/lib/grid.ts";
import { api } from "./api";
import { useGuardian } from "./useGuardian";
import { AlertFeed } from "#/components/grid/AlertFeed";
import { EarlyWarnings } from "#/components/grid/EarlyWarnings";
import { Kpi } from "#/components/grid/Kpi";
import { MetricChart } from "#/components/grid/MetricChart";
import { NetworkMap } from "#/components/grid/NetworkMap";
import { NodeGrid } from "#/components/grid/NodeGrid";
import { TroubleControls } from "#/components/grid/TroubleControls";
import { fmtUnit } from "./format";
import {
  useAnomalies,
  useForecasts,
  useLatest,
  useNodeStatuses,
  useNodes,
  useSeries,
  useStats,
  type NodeStatus,
} from "./hooks";

// ---------- KPI maths (plain functions, easy to test) ----------

/** Latest value of one metric on every node. */
function valuesOf(latest: Latest, metric: Metric): number[] {
  return Object.values(latest)
    .map((node) => node[metric])
    .filter((v): v is number => v !== undefined);
}

function average(values: number[]): number {
  return values.length
    ? values.reduce((sum, v) => sum + v, 0) / values.length
    : NaN;
}

/** Share of nodes without a recent open alert, in %. */
function gridHealth(nodeCount: number, statuses: Record<string, NodeStatus>) {
  const degraded = Object.values(statuses).filter((s) => s !== "ok").length;
  const percent = nodeCount
    ? Math.round(((nodeCount - degraded) / nodeCount) * 100)
    : 100;
  const tone: NodeStatus =
    percent < 70 ? "critical" : percent < 90 ? "high" : "ok";
  return { percent, degraded, tone };
}

function openAlerts(stats: Stats | undefined) {
  const critical = stats?.openBySeverity.critical ?? 0;
  const total = stats
    ? stats.openBySeverity.medium + stats.openBySeverity.high + critical
    : 0;
  const tone: NodeStatus =
    critical > 0 ? "critical" : total > 0 ? "medium" : "ok";
  return { critical, total, tone };
}

// ---------- page ----------

function OverviewChart({ metric }: { metric: Metric }) {
  const { data } = useSeries(metric);
  const { data: anomalies } = useAnomalies();
  return <MetricChart metric={metric} data={data} anomalies={anomalies} />;
}

export function OverviewPage() {
  const { data: nodes = [] } = useNodes();
  const { data: latest = {} } = useLatest();
  const { data: anomalies = [] } = useAnomalies();
  const { data: forecasts = [] } = useForecasts();
  const { data: stats } = useStats();
  const statuses = useNodeStatuses();

  // Demo buttons: commander only (admin rights), the API checks this too.
  const { canControlSimulator } = useGuardian();
  const overheat = useMutation({
    mutationFn: () => api.ramp({ metric: "temperature" }),
  });
  const glitch = useMutation({ mutationFn: () => api.glitch() });
  const desync = useMutation({ mutationFn: api.desync });

  const health = gridHealth(nodes.length, statuses);
  const alerts = openAlerts(stats);
  const online = Object.keys(latest).length;
  const drifts = valuesOf(latest, "drift");
  const maxDrift = drifts.length ? Math.max(...drifts) : NaN; // NaN shows "-" until data arrives
  const avgLead = stats?.avgLeadSeconds;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="ribbon">Headquarters · vs. The Desync</span>
          <h1>Mission Control</h1>
        </div>
        {canControlSimulator && (
        <div className="actions">
          <button
            onClick={() => overheat.mutate()}
            title="A slow build-up the forecaster can see coming"
          >
            Start overheating
          </button>
          <button className="magic" onClick={() => glitch.mutate()}>
            Inject glitch
          </button>
          <button className="danger" onClick={() => desync.mutate()}>
            Trigger Desync wave
          </button>
          <TroubleControls />
        </div>
        )}
      </div>

      <section className="kpis">
        <Kpi
          label="Grid health"
          value={`${health.percent}%`}
          sub={`${online}/${nodes.length} online · ${health.degraded} degraded`}
          tone={health.tone}
        />
        <Kpi
          label="Early warnings"
          value={String(forecasts.length)}
          sub={
            avgLead != null
              ? `seen ${Math.round(avgLead)}s ahead on avg`
              : "trend forecasting active"
          }
          tone={forecasts.length > 0 ? "medium" : "ok"}
        />
        <Kpi
          label="Avg mana load"
          value={fmtUnit("load", average(valuesOf(latest, "load")))}
        />
        <Kpi
          label="Avg latency"
          value={fmtUnit("latency", average(valuesOf(latest, "latency")))}
        />
        <Kpi
          label="Max sync drift"
          value={fmtUnit("drift", maxDrift)}
          tone={maxDrift > 30 ? "high" : "ok"}
        />
        <Kpi
          label="Open alerts"
          value={String(alerts.total)}
          sub={`${alerts.critical} critical · ${stats?.lastHour ?? 0} last hour`}
          tone={alerts.tone}
        />
      </section>

      <section className="split">
        <NetworkMap nodes={nodes} statuses={statuses} forecasts={forecasts} />
        <div className="stack">
          <EarlyWarnings forecasts={forecasts} nodes={nodes} />
          <AlertFeed anomalies={anomalies} />
        </div>
      </section>

      <section className="charts">
        {METRICS.map((m) => (
          <OverviewChart key={m} metric={m} />
        ))}
      </section>

      <h2>Nodes</h2>
      <NodeGrid nodes={nodes} statuses={statuses} />
    </div>
  );
}
