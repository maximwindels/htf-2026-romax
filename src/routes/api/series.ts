import { createFileRoute } from '@tanstack/react-router'
import { METRICS, type Metric } from '#/lib/grid.ts'
import { numberParam } from '#/server/grid/http.ts'
import { series } from '#/server/grid/queries.ts'
import { ensureGridRunning } from '#/server/grid/runtime.ts'

/** GET /api/series?metric=load&minutes=5[&nodeId=] - one chart point per tick. */
export const Route = createFileRoute('/api/series')({
  server: {
    handlers: {
      GET: ({ request }) => {
        ensureGridRunning()
        const query = new URL(request.url).searchParams
        const metric = query.get('metric') ?? 'load'
        if (!METRICS.includes(metric as Metric)) return Response.json({ error: 'unknown metric' }, { status: 400 })
        const minutes = Math.max(numberParam(query.get('minutes'), 5, 60), 1)
        return Response.json(series(metric as Metric, minutes, query.get('nodeId') ?? undefined))
      },
    },
  },
})
