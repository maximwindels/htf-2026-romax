import { useEffect, useRef, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { AetherBadge } from '#/components/AetherBadge.tsx'
import { PixelCrystal } from '#/components/grid/PixelCrystal'
import { PixelIcon } from '#/components/grid/PixelIcon'
import { RoleBadge } from '#/components/RoleBadge.tsx'
import { PixelAvatar } from '#/components/grid/PixelAvatar.tsx'
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
    <div ref={ref} className="user-menu">
      {/* Same shape as the sidebar items: the avatar sits where their icons sit, the name shows when the rail opens. */}
      <button
        type="button"
        aria-label="User menu"
        aria-expanded={open}
        title={guardian.codename}
        onClick={() => setOpen((o) => !o)}
        className={`user-chip role-${guardian.role} ${open ? 'is-open' : ''}`}
      >
        <span className="user-chip-avatar">
          <PixelAvatar codename={guardian.codename} role={guardian.role} size={26} />
          {/* Aether Charges, pinned to the avatar */}
          <span className="user-chip-aether">
            <AetherBadge guardianId={guardian.guardianId} />
          </span>
        </span>
        <span className="side-tab-label user-chip-text">
          <span className="user-chip-name">{guardian.codename}</span>
          <span className="user-chip-role">{guardian.role}</span>
        </span>
      </button>

      {open && (
        <div className={`user-pop role-${guardian.role}`} role="menu">
          <div className="user-pop-head">
            <PixelAvatar codename={guardian.codename} role={guardian.role} size={56} />
            <div>
              <span className="user-pop-label">Logged in as</span>
              <span className="user-pop-name">
                {guardian.codename}
                <AetherBadge guardianId={guardian.guardianId} />
              </span>
              <RoleBadge role={guardian.role} />
            </div>
          </div>
          <button type="button" role="menuitem" onClick={onLogout} className="user-pop-logout">
            <LogOut className="size-4" strokeWidth={2} />
            Leave the watch
          </button>
        </div>
      )}
    </div>
  )
}
