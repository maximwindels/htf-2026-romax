import type { Severity } from '#/lib/grid.ts';

export interface SeverityBadgeProps {
  severity: Severity | 'ok' | 'warning';
}

/** Small square tag: OK, WARNING, MEDIUM, HIGH or CRITICAL. */
export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return <span className={`badge badge-${severity}`}>{severity}</span>;
}
