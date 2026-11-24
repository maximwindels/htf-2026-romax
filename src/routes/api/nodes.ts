import { createFileRoute } from '@tanstack/react-router'
import { listNodes } from '#/server/grid/queries.ts'
import { ensureGridRunning } from '#/server/grid/runtime.ts'

export const Route = createFileRoute('/api/nodes')({
  server: {
    handlers: {
      GET: () => {
        ensureGridRunning()
        return Response.json(listNodes())
      },
    },
  },
})
