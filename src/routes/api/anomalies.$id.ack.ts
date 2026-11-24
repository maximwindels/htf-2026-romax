import { createFileRoute } from '@tanstack/react-router'
import { denyUnless } from '#/server/grid/http.ts'
import { acknowledge } from '#/server/grid/queries.ts'

/** POST /api/anomalies/:id/ack - every open dashboard gets an `ack` event. */
export const Route = createFileRoute('/api/anomalies/$id/ack')({
  server: {
    handlers: {
      POST: ({ params }) => {
        const denied = denyUnless()
        if (denied) return denied
        const anomaly = acknowledge(Number(params.id))
        return anomaly ? Response.json(anomaly) : Response.json({ error: 'not found' }, { status: 404 })
      },
    },
  },
})
