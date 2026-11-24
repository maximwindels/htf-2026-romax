import { createFileRoute } from '@tanstack/react-router'
import { denyUnless } from '#/server/grid/http.ts'
import { stats } from '#/server/grid/queries.ts'
import { ensureGridRunning } from '#/server/grid/runtime.ts'

/** Numbers for the KPI cards. */
export const Route = createFileRoute('/api/stats')({
  server: {
    handlers: {
      GET: () => {
        const denied = denyUnless()
        if (denied) return denied
        ensureGridRunning()
        return Response.json(stats())
      },
    },
  },
})
