import { createFileRoute } from '@tanstack/react-router'
import { denyUnless } from '#/server/grid/http.ts'
import { ensureGridRunning } from '#/server/grid/runtime.ts'
import { liveStream } from '#/server/grid/stream.ts'

/** Server-Sent Events: tick, anomaly, ack, warning, warning-confirmed, glitch, ping. */
export const Route = createFileRoute('/api/stream')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const denied = denyUnless()
        if (denied) return denied
        ensureGridRunning()
        return liveStream(request)
      },
    },
  },
})
