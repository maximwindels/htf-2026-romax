import { createFileRoute } from '@tanstack/react-router'
import { denyUnless, numberParam } from '#/server/grid/http.ts'
import { listAnomalies } from '#/server/grid/queries.ts'
import { ensureGridRunning } from '#/server/grid/runtime.ts'

/** GET /api/anomalies?limit=500[&status=open] */
export const Route = createFileRoute('/api/anomalies')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const denied = denyUnless()
        if (denied) return denied
        ensureGridRunning()
        const query = new URL(request.url).searchParams
        return Response.json(listAnomalies(numberParam(query.get('limit'), 200, 1000), query.get('status') === 'open'))
      },
    },
  },
})
