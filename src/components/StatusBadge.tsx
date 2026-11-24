import { STATUS_LABELS, type GlitchStatus } from '#/lib/glitch.ts'

const styles: Record<GlitchStatus, { badge: string; dot: string }> = {
  LEAKED: { badge: 'bg-red-500/15 text-red-300', dot: 'bg-red-500 animate-pulse' },
  ASSESSING: { badge: 'bg-amber-500/15 text-amber-300', dot: 'bg-amber-500' },
  CONTAINING: { badge: 'bg-sky-500/15 text-sky-300', dot: 'bg-sky-500' },
  FIXED: { badge: 'bg-emerald-500/15 text-emerald-300', dot: 'bg-emerald-500' },
}

export function StatusBadge({ status }: { status: GlitchStatus }) {
  const { badge, dot } = styles[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${badge}`}
    >
      <span className={`size-1.5 rounded-full ${dot}`} />
      {STATUS_LABELS[status]}
    </span>
  )
}
