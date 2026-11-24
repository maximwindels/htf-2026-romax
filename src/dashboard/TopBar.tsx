import { Link } from '@tanstack/react-router'
import { Keyboard, Moon, Presentation, Sun, Volume2, VolumeX } from 'lucide-react'
import { DESYNC_LEVELS, type DesyncState } from './desync'
import { PixelCrystal } from '#/components/grid/PixelCrystal'
import { openShortcutsHelp } from '#/lib/shortcuts.ts'
import { togglePresent, toggleTheme, usePresent, useTheme } from '#/lib/theme.ts'
import { toggleSound, useSoundOn } from './alerts'
import { fmtTime } from './format'
import { useNow } from './hooks'
import type { LiveStatus } from './live'
import { toggleOracle } from './Oracle'

/** Top bar above every page: brand, magic meter, theme/sound toggles, live-connection status and the clock. */
export function TopBar({ liveStatus, desync }: { liveStatus: LiveStatus; desync: DesyncState }) {
  const now = useNow(1000)
  const soundOn = useSoundOn()
  const theme = useTheme()
  const present = usePresent()

  return (
    <header className="topbar grid-ui">
      {/* The brand doubles as the way home. */}
      <Link to="/" className="brand" title="Back to the dashboard">
        <PixelCrystal />
        <span className="brand-title extrude">Achrona</span>
        <span className="brand-sub">Guardians of the Grid</span>
      </Link>

      <div className="topbar-right">
        <div
          className={`magic-meter level-${desync.level}`}
          title={`${desync.errors} open error${desync.errors === 1 ? '' : 's'} (critical counts double). Levels: 0 Stable · 1 Unstable (1+) · 2 Corrupted (3+) · 3 Desync (6+)`}
        >
          <span className="magic-label">Magic</span>
          <span className="magic-bar" aria-hidden>
            <span style={{ width: `${desync.magic}%` }} />
          </span>
          <span className={`desync-level level-${desync.level}`}>
            LVL {desync.level} · {DESYNC_LEVELS[desync.level].name}
          </span>
          {/* Mini-game results: immunity from flawless wins, backlash from fails. */}
          {desync.multiplier < 1 && (
            <span className="desync-chip is-immune" title="Desync Immunity from flawless stabilizations: every error drains less magic">
              Immune {Math.round((1 - desync.multiplier) * 100)}%
            </span>
          )}
          {desync.backlash > 0 && (
            <span className="desync-chip is-backlash" title="A failed mini-game: extra corruption, fading out">
              Backlash +{desync.backlash}%
            </span>
          )}
        </div>
        {/* Downloads the High Council PDF (Content-Disposition: attachment, so the page stays open). */}
        <button type="button" className="btn-small oracle-btn" onClick={toggleOracle} title="Ask the Oracle about incidents and alerts (O)">
          Oracle
        </button>
        <a className="btn-report" href="/api/report" title="Export the most important data as a PDF for the High Council">
          Report PDF
        </a>
        <button
          className="btn-small ghost inline-flex items-center max-sm:hidden"
          onClick={openShortcutsHelp}
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
        >
          <Keyboard className="size-4" />
        </button>
        <button
          className="btn-small ghost inline-flex items-center"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode (T)`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        {/* Presentation mode: bigger and higher contrast, for a projector. Not useful on a phone. */}
        <button
          className={`btn-small inline-flex items-center gap-1.5 whitespace-nowrap max-sm:hidden ${present ? 'present-toggle is-on' : 'ghost'}`}
          onClick={togglePresent}
          title={present ? 'Leave presentation mode (P)' : 'Presentation mode: bigger and clearer on a projector (P)'}
          aria-pressed={present}
        >
          <Presentation className="size-4" />
          {present && 'Presenting'}
        </button>
        {/* Mute switch for everything: alert beeps, the Desync hum and the stabilize chime. Off by default. */}
        <button
          className={`btn-small sound-toggle inline-flex items-center gap-1.5 whitespace-nowrap ${soundOn ? 'is-on' : 'ghost'}`}
          onClick={toggleSound}
          title={soundOn ? 'Mute all sound' : 'Turn sound on (alerts, Desync hum, chimes)'}
          aria-pressed={soundOn}
        >
          {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          {soundOn ? 'Sound on' : 'Muted'}
        </button>
        <span className={`live live-${liveStatus}`}>
          <span className="live-dot" /> {liveStatus}
        </span>
        {/* Server and browser clocks differ; the browser's wins. */}
        <span className="mono muted topbar-clock" suppressHydrationWarning>
          {fmtTime(now)}
        </span>
      </div>
    </header>
  )
}
