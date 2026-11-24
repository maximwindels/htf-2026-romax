import type { NodeStatus } from '#/dashboard/hooks';

export interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  /** colours the card: ok = blue, medium = purple, high = orange, critical = red */
  tone?: NodeStatus;
}

/** One KPI card on the overview. */
export function Kpi({ label, value, sub, tone = 'ok' }: KpiProps) {
  return (
    <div className={`card kpi tone-${tone}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
