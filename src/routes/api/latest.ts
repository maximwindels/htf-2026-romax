import { createFileRoute } from '@tanstack/react-router'
import { latestValues } from '#/server/grid/queries.ts'
import { ensureGridRunning } from '#/server/grid/runtime.ts'

/** Latest value per node per metric. */
export const Route = createFileRoute('/api/latest')({
  server: {
    handlers: {
      GET: () => {
        ensureGridRunning()
        return Response.json(latestValues())
      },
    },
  },
})
