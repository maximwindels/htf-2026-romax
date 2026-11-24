import { createFileRoute } from '@tanstack/react-router'
import { ensureGridRunning } from '#/server/grid/runtime.ts'
import { liveStream } from '#/server/grid/stream.ts'

/** Server-Sent Events: tick, anomaly, ack, warning, warning-confirmed, glitch, ping. */
export const Route = createFileRoute('/api/stream')({
  server: {
    handlers: {
      GET: ({ request }) => {
        ensureGridRunning()
        return liveStream(request)
      },
    },
  },
})
