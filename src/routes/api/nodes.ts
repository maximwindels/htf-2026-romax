import { createFileRoute } from '@tanstack/react-router'
import { denyUnless } from '#/server/grid/http.ts'
import { listNodes } from '#/server/grid/queries.ts'
import { ensureGridRunning } from '#/server/grid/runtime.ts'

export const Route = createFileRoute('/api/nodes')({
  server: {
    handlers: {
      GET: () => {
        const denied = denyUnless()
        if (denied) return denied
        ensureGridRunning()
        return Response.json(listNodes())
      },
    },
  },
})
