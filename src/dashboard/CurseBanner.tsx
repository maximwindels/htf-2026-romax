import { useFlash } from './alerts'
import { useNow } from './hooks'

/** "The Desync strikes!" banner, shown for a moment after every critical alert. */
export function CurseBanner() {
  const now = useNow(1000)
  const flashUntil = useFlash()
  if (flashUntil <= now) return null
  return (
    // key = flashUntil restarts the animation for every new critical alert
    <div key={flashUntil} className="curse-banner" role="status">
      The Desync strikes!
    </div>
  )
}
