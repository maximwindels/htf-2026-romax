import { createFileRoute } from '@tanstack/react-router'
import { acknowledge } from '#/server/grid/queries.ts'

/** POST /api/anomalies/:id/ack - every open dashboard gets an `ack` event. */
export const Route = createFileRoute('/api/anomalies/$id/ack')({
  server: {
    handlers: {
      POST: ({ params }) => {
        const anomaly = acknowledge(Number(params.id))
        return anomaly ? Response.json(anomaly) : Response.json({ error: 'not found' }, { status: 404 })
      },
    },
  },
})
