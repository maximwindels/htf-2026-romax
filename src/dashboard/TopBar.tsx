import { PixelCrystal } from '#/components/grid/PixelCrystal'
import { toggleSound, useSoundOn } from './alerts'
import { fmtTime } from './format'
import { useNow } from './hooks'
import type { LiveStatus } from './live'

/** Top bar above every page: brand, sound toggle, live-connection status and the clock. */
export function TopBar({ liveStatus }: { liveStatus: LiveStatus }) {
  const now = useNow(1000)
  const soundOn = useSoundOn()

  return (
    <header className="topbar grid-ui">
      <div className="brand">
        <PixelCrystal />
        <span className="brand-title extrude">Achrona</span>
        <span className="brand-sub">Guardians of the Grid</span>
      </div>

      <div className="topbar-right">
        <button className="btn-small ghost" onClick={toggleSound} title="Sound on critical alerts">
          {soundOn ? '🔊' : '🔇'}
        </button>
        <span className={`live live-${liveStatus}`}>
          <span className="live-dot" /> {liveStatus}
        </span>
        {/* Server and browser clocks differ; the browser's wins. */}
        <span className="mono muted" suppressHydrationWarning>
          {fmtTime(now)}
        </span>
      </div>
    </header>
  )
}
