import { useEffect, useRef } from 'react'
import { visibleTabs } from '#/dashboard/tabs'
import { useRouter } from '@tanstack/react-router'
import { X } from 'lucide-react'
import type { GlitchDetail } from '#/lib/glitch.ts'
import { isCommander, type Guardian } from '#/lib/guardian.ts'
import {
  SHORTCUTS,
  closeShortcutsHelp,
  isTypingTarget,
  openShortcutsHelp,
  useShortcutsHelpOpen,
} from '#/lib/shortcuts.ts'
import { toggleTheme } from '#/lib/theme.ts'

/** How long after `G` the second key of a "go to" chord is accepted. */
const CHORD_MS = 1200

/** Global keyboard shortcuts for the logged-in app, plus the `?` help dialog. */
export function KeyboardShortcuts({ guardian }: { guardian: Guardian }) {
  const router = useRouter()
  const helpOpen = useShortcutsHelpOpen()

  useEffect(() => {
    let chordUntil = 0

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
      if (isTypingTarget(e.target)) return
      // Another modal (e.g. the report-echo dialog) owns the keyboard while it is open.
      if (document.querySelector('dialog[open]:not([data-shortcuts-help])')) return

      const key = e.key.toLowerCase()
      const path = router.state.location.pathname
      /** Claims the key press and runs the shortcut. */
      const run = (action: () => unknown) => {
        e.preventDefault()
        void action()
      }

      // Second key of a "G then …" chord.
      if (Date.now() < chordUntil) {
        chordUntil = 0
        if (key === 'o') return run(() => router.navigate({ to: '/' }))
        if (key === 'a') return run(() => router.navigate({ to: '/anomalies' }))
        if (key === 'l') return run(() => router.navigate({ to: '/leaderboard' }))
        if (key === 'g' && isCommander(guardian)) return run(() => router.navigate({ to: '/guardians' }))
        return
      }

      if (e.key === '?') return run(openShortcutsHelp)
      if (key === 'g') return run(() => (chordUntil = Date.now() + CHORD_MS))
      if (key === 't') return run(toggleTheme)
      if (key === 'n') {
        // On the Glitches tab the dialog opens right there; everywhere else on the dashboard.
        const to = path === '/glitches' || path === '/glitches/' ? '/glitches' : '/'
        return run(() => router.navigate({ to, search: { report: true } }))
      }

      // 1-8: switch tab, in the order of the tab bar.
      if (/^[1-9]$/.test(e.key)) {
        const tab = visibleTabs(isCommander(guardian))[Number(e.key) - 1]
        if (tab) return run(() => router.navigate({ to: tab.to }))
      }

      // Overview: move focus through the glitch rows; Enter (on the row) opens it.
      if ((path === '/' || path === '/glitches' || path === '/glitches/') && (key === 'j' || key === 'k')) {
        const rows = [...document.querySelectorAll<HTMLElement>('[data-glitch-row]')]
        if (rows.length === 0) return
        return run(() => {
          const current = rows.indexOf(document.activeElement as HTMLElement)
          const next = current === -1 ? 0 : current + (key === 'j' ? 1 : -1)
          const row = rows[Math.max(0, Math.min(rows.length - 1, next))]
          row.focus()
          row.scrollIntoView({ block: 'nearest' })
        })
      }

      // Glitch page: step through glitches in list order, go back, or jump to the mini-game.
      const glitch = router.state.matches.find((m) => m.routeId === '/_app/glitches/$glitchId')
        ?.loaderData as GlitchDetail | undefined
      if (glitch) {
        const target = key === 'j' ? glitch.olderId : key === 'k' ? glitch.newerId : undefined
        if (target) return run(() => router.navigate({ to: '/glitches/$glitchId', params: { glitchId: target } }))
        if (key === 'u') return run(() => router.navigate({ to: '/' }))
        const slider = document.querySelector<HTMLElement>('[data-stabilizer-start]')
        if (key === 's' && slider) {
          return run(() => {
            slider.focus()
            slider.scrollIntoView({ block: 'center', behavior: 'smooth' })
          })
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [router, guardian])

  return <ShortcutsHelp open={helpOpen} commander={isCommander(guardian)} />
}

function ShortcutsHelp({ open, commander }: { open: boolean; commander: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      data-shortcuts-help
      onClose={closeShortcutsHelp}
      onClick={(e) => e.target === ref.current && closeShortcutsHelp()}
      className="grid-ui m-auto w-full max-w-md rounded-[15px] border border-line bg-panel p-0 text-fg backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <span className="card-title m-0 border-0 p-0">Keyboard shortcuts</span>
          <button type="button" className="btn-small ghost" onClick={closeShortcutsHelp} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        {SHORTCUTS.map(({ group, items }) => (
          <section key={group} className="flex flex-col gap-2">
            <h3 className="field-label">{group}</h3>
            <ul className="flex flex-col gap-1.5">
              {items
                .filter((item) => commander || !item.commanderOnly)
                .map(({ keys, label }) => (
                  <li key={label} className="flex items-center justify-between gap-4 text-sm">
                    <span>{label}</span>
                    <span className="flex items-center gap-1">
                      {keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="muted text-xs">then</span>}
                          <kbd className="kbd">{k}</kbd>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </dialog>
  )
}
