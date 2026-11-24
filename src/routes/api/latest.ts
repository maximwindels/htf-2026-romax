import { createFileRoute } from '@tanstack/react-router'
import { denyUnless } from '#/server/grid/http.ts'
import { latestValues } from '#/server/grid/queries.ts'
import { ensureGridRunning } from '#/server/grid/runtime.ts'

/** Latest value per node per metric. */
export const Route = createFileRoute('/api/latest')({
  server: {
    handlers: {
      GET: () => {
        const denied = denyUnless()
        if (denied) return denied
        ensureGridRunning()
        return Response.json(latestValues())
      },
    },
  },
})
