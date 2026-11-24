import { useEffect, useRef, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import {
  Activity,
  Castle,
  ChartLine,
  LayoutGrid,
  LogOut,
  Map,
  Sparkles,
  TriangleAlert,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { AetherBadge } from '#/components/AetherBadge.tsx'
import { RoleBadge } from '#/components/RoleBadge.tsx'
import { logout } from '#/lib/auth.functions.ts'
import { isCommander, type Guardian } from '#/lib/guardian.ts'

type NavItem = {
  label: string
  icon: LucideIcon
  to: '/' | '/map' | '/vitals' | '/nodes' | '/glitches' | '/anomalies' | '/leaderboard' | '/guardians'
  /** Hidden for defenders. */
  commanderOnly?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutGrid, to: '/' },
  { label: 'Map', icon: Map, to: '/map' },
  { label: 'Vitals', icon: ChartLine, to: '/vitals' },
  { label: 'Nodes', icon: Castle, to: '/nodes' },
  { label: 'Glitches', icon: Sparkles, to: '/glitches' },
  { label: 'Anomalies', icon: TriangleAlert, to: '/anomalies' },
  { label: 'Leaderboard', icon: Trophy, to: '/leaderboard' },
  { label: 'Guardians', icon: Users, to: '/guardians', commanderOnly: true },
]

// Icon-only items: the label lives in aria-label/title for screen readers and hover.
const itemClass =
  'flex size-12 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white'
const activeClass = 'bg-white/10 text-white'

export function Sidebar({ guardian }: { guardian: Guardian }) {
  const visibleItems = navItems.filter((item) => !item.commanderOnly || isCommander(guardian))

  return (
    <aside className="sticky top-0 flex h-screen w-20 shrink-0 flex-col items-center bg-sidebar py-5">
      <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-linear-to-br from-accent-from to-accent-to text-white shadow-md shadow-black/30">
        <Activity className="size-7" strokeWidth={2} />
      </div>

      <nav className="flex w-full flex-1 flex-col items-center gap-1">
        {visibleItems.map(({ label, icon: Icon, to }) => (
          <Link
            key={label}
            to={to}
            aria-label={label}
            title={label}
            className={itemClass}
            activeOptions={{ exact: to === '/' }}
            activeProps={{ className: activeClass }}
          >
            <Icon className="size-6" strokeWidth={1.5} />
          </Link>
        ))}
      </nav>

      <UserMenu guardian={guardian} />
    </aside>
  )
}

function UserMenu({ guardian }: { guardian: Guardian }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function onLogout() {
    await logout()
    await router.invalidate()
    await router.navigate({ to: '/login', replace: true })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="User menu"
        aria-expanded={open}
        title={guardian.codename}
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-10 items-center justify-center rounded-full border border-line bg-card text-sm font-semibold text-fg transition-colors hover:bg-subtle"
      >
        {guardian.codename.slice(0, 1).toUpperCase()}
        {/* Aether Charges, pinned to the avatar */}
        <span className="absolute -top-2 -right-3">
          <AetherBadge guardianId={guardian.guardianId} />
        </span>
      </button>

      {open && (
        <div className="absolute bottom-0 left-full z-20 ml-3 w-56 rounded-2xl border border-line bg-card p-2 shadow-xl shadow-black/10">
          <div className="flex flex-col gap-2 px-3 py-2">
            <span className="text-xs text-muted">Logged in as</span>
            <span className="inline-flex items-center gap-2 font-semibold text-fg">
              {guardian.codename}
              <AetherBadge guardianId={guardian.guardianId} />
            </span>
            <span>
              <RoleBadge role={guardian.role} />
            </span>
          </div>
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-subtle"
          >
            <LogOut className="size-4" strokeWidth={1.75} />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
