import { useEffect, useRef, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { AetherBadge } from '#/components/AetherBadge.tsx'
import { PixelCrystal } from '#/components/grid/PixelCrystal'
import { PixelIcon } from '#/components/grid/PixelIcon'
import { RoleBadge } from '#/components/RoleBadge.tsx'
import { visibleTabs } from '#/dashboard/tabs'
import { logout } from '#/lib/auth.functions.ts'
import { isCommander, type Guardian } from '#/lib/guardian.ts'

/**
 * The one navigation of the app: every section on the left, with its pixel icon, name and
 * number key (1-8, see KeyboardShortcuts). The dashboard only lights up on "/" itself; the other
 * sections stay lit on their detail pages (a glitch page lights "Glitches"). It shows only the
 * icons and opens fully on hover (grid.css .side-nav).
 */
export function Sidebar({ guardian }: { guardian: Guardian }) {
  const tabs = visibleTabs(isCommander(guardian))

  return (
    // The aside keeps the narrow icon-rail width in the layout; the inner panel slides open over the
    // page on hover or keyboard focus, so the content never jumps (grid.css .side-nav).
    <aside className="side-nav grid-ui">
      <div className="side-nav-panel">
      <Link to="/" className="side-nav-logo" title="Achrona · dashboard" aria-label="Achrona, go to the dashboard">
        <PixelCrystal />
      </Link>

      <nav className="side-nav-list" aria-label="Sections">
        {tabs.map((tab, i) => (
          <Link
            key={tab.to}
            to={tab.to}
            className="side-tab"
            activeOptions={{ exact: tab.to === '/' }}
            activeProps={{ className: 'side-tab is-active', 'aria-current': 'page' }}
            title={`${tab.label} (${i + 1})`}
          >
            <PixelIcon name={tab.icon} size={20} />
            <span className="side-tab-label">{tab.label}</span>
            <kbd className="side-tab-key">{i + 1}</kbd>
          </Link>
        ))}
      </nav>

      <div className="side-nav-user">
        <UserMenu guardian={guardian} />
      </div>
      </div>
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
        <div className="user-menu-pop absolute bottom-0 left-full z-20 ml-3 w-56 rounded-2xl border border-line bg-card p-2 shadow-xl shadow-black/10">
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
