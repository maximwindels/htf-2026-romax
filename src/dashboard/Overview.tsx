import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { METRICS, type Latest, type Metric, type Stats } from "#/lib/grid.ts";
import { api } from "./api";
import { useGuardian } from "./useGuardian";
import { AlertFeed } from "#/components/grid/AlertFeed";
import { EarlyWarnings } from "#/components/grid/EarlyWarnings";
import { Kpi } from "#/components/grid/Kpi";
import { MetricChart } from "#/components/grid/MetricChart";
import { NetworkMap } from "#/components/grid/NetworkMap";
import { NodeGrid, NodeStrip } from "#/components/grid/NodeGrid";
import { MiniVital } from "#/components/grid/MiniVital";
import { PixelIcon, type PixelIconName } from "#/components/grid/PixelIcon";
import type { TabPath } from "./tabs";
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

// ---------- building blocks (shared by the dashboard and the tabs) ----------

export function OverviewChart({ metric }: { metric: Metric }) {
  const { data } = useSeries(metric);
  const { data: anomalies } = useAnomalies();
  return <MetricChart metric={metric} data={data} anomalies={anomalies} />;
}

function OverviewMiniVital({ metric }: { metric: Metric }) {
  const { data } = useSeries(metric);
  return <MiniVital metric={metric} data={data} />;
}

/** Ribbon, title and (for commanders) the demo controls that inject trouble. */
export function MissionHeader({ ribbon, title }: { ribbon: string; title: string }) {
  const { canControlSimulator } = useGuardian();
  const overheat = useMutation({
    mutationFn: () => api.ramp({ metric: "temperature" }),
  });
  const glitch = useMutation({ mutationFn: () => api.glitch() });
  const desync = useMutation({ mutationFn: api.desync });

  return (
    <div className="page-head">
      <div>
        <span className="ribbon">{ribbon}</span>
        <h1>{title}</h1>
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
  );
}

/** The six KPI cards. */
export function KpiRow() {
  const { data: nodes = [] } = useNodes();
  const { data: latest = {} } = useLatest();
  const { data: forecasts = [] } = useForecasts();
  const { data: stats } = useStats();
  const statuses = useNodeStatuses();

  const health = gridHealth(nodes.length, statuses);
  const alerts = openAlerts(stats);
  const online = Object.keys(latest).length;
  const drifts = valuesOf(latest, "drift");
  const maxDrift = drifts.length ? Math.max(...drifts) : NaN; // NaN shows "-" until data arrives
  const avgLead = stats?.avgLeadSeconds;

  return (
    <section className="kpis">
      <Kpi
        label="Grid health"
        icon="crystal"
        value={`${health.percent}%`}
        sub={`${online}/${nodes.length} online · ${health.degraded} degraded`}
        tone={health.tone}
      />
      <Kpi
        label="Early warnings"
        icon="eye"
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
        icon="load"
        value={fmtUnit("load", average(valuesOf(latest, "load")))}
      />
      <Kpi
        label="Avg latency"
        icon="latency"
        value={fmtUnit("latency", average(valuesOf(latest, "latency")))}
      />
      <Kpi
        label="Max sync drift"
        icon="drift"
        value={fmtUnit("drift", maxDrift)}
        tone={maxDrift > 30 ? "high" : "ok"}
      />
      <Kpi
        label="Open alerts"
        icon="skull"
        value={String(alerts.total)}
        sub={`${alerts.critical} critical · ${stats?.lastHour ?? 0} last hour`}
        tone={alerts.tone}
      />
    </section>
  );
}

/** The map with the early warnings and open alerts next to it. */
export function MapWithFeeds() {
  const { data: nodes = [] } = useNodes();
  const { data: anomalies = [] } = useAnomalies();
  const { data: forecasts = [] } = useForecasts();
  const statuses = useNodeStatuses();
  return (
    <section className="split">
      <NetworkMap nodes={nodes} statuses={statuses} forecasts={forecasts} />
      <div className="stack">
        <EarlyWarnings forecasts={forecasts} nodes={nodes} />
        <AlertFeed anomalies={anomalies} />
      </div>
    </section>
  );
}

/** A section heading with a pixel icon and a link to the tab that shows it in full. */
function BlockTitle({
  icon,
  title,
  to,
  linkLabel,
}: {
  icon: PixelIconName;
  title: string;
  to: TabPath;
  linkLabel: string;
}) {
  return (
    <div className="block-title">
      <h2 className="section-title">
        <PixelIcon name={icon} size={27} />
        {title}
      </h2>
      <Link to={to} className="block-link">
        {linkLabel} →
      </Link>
    </div>
  );
}

// ---------- the dashboard: a bit of everything, on (almost) one screen ----------

export function OverviewPage({ glitchSummary }: { glitchSummary?: ReactNode }) {
  const { data: nodes = [] } = useNodes();
  const { data: anomalies = [] } = useAnomalies();
  const { data: forecasts = [] } = useForecasts();
  const statuses = useNodeStatuses();

  return (
    <div className="page dashboard">
      <div className="grid-ui">
        <MissionHeader ribbon="Headquarters · vs. The Desync" title="Mission Control" />
        <KpiRow />
        <section className="dash-main">
          <NetworkMap nodes={nodes} statuses={statuses} forecasts={forecasts} />
          <div className="stack">
            <EarlyWarnings forecasts={forecasts} nodes={nodes} />
            <AlertFeed anomalies={anomalies} />
            <div className="mini-vitals">
              {METRICS.map((m) => (
                <OverviewMiniVital key={m} metric={m} />
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="dash-bottom">
        <div className="grid-ui">{glitchSummary}</div>
        <div className="grid-ui">
          <BlockTitle icon="town" title="Nodes" to="/nodes" linkLabel="All node details" />
          <NodeStrip nodes={nodes} statuses={statuses} />
        </div>
      </section>
    </div>
  );
}

// ---------- the full tabs ----------

/** Map tab: the map as big as it gets, with the feeds next to it. */
export function MapTabPage() {
  return (
    <div className="page map-tab">
      <MissionHeader ribbon="The realm · ley lines" title="Map of Achrona" />
      <MapWithFeeds />
    </div>
  );
}

/** Vitals tab: the four big charts. */
export function VitalsTabPage() {
  return (
    <div className="page">
      <MissionHeader ribbon="Scrying glass · last 5 minutes" title="Vitals" />
      <KpiRow />
      <section className="charts">
        {METRICS.map((m) => (
          <OverviewChart key={m} metric={m} />
        ))}
      </section>
    </div>
  );
}

/** Nodes tab: one full card per node. */
export function NodesTabPage() {
  const { data: nodes = [] } = useNodes();
  const statuses = useNodeStatuses();
  return (
    <div className="page">
      <MissionHeader ribbon="Every town of Achrona" title="Nodes" />
      <NodeGrid nodes={nodes} statuses={statuses} />
    </div>
  );
}

export { BlockTitle };
