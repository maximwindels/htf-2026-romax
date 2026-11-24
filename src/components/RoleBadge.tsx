import { Shield, ShieldCheck } from 'lucide-react'
import type { GuardianRole } from '#/lib/guardian.ts'

const styles: Record<GuardianRole, string> = {
  commander: 'bg-accent/10 text-accent',
  defender: 'bg-subtle text-muted',
}

export function RoleBadge({ role }: { role: GuardianRole }) {
  const Icon = role === 'commander' ? ShieldCheck : Shield
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${styles[role]}`}
    >
      <Icon className="size-3.5" strokeWidth={2} />
      {role}
    </span>
  )
}
