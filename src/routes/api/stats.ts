import { createFileRoute } from '@tanstack/react-router'
import { stats } from '#/server/grid/queries.ts'
import { ensureGridRunning } from '#/server/grid/runtime.ts'

/** Numbers for the KPI cards. */
export const Route = createFileRoute('/api/stats')({
  server: {
    handlers: {
      GET: () => {
        ensureGridRunning()
        return Response.json(stats())
      },
    },
  },
})
