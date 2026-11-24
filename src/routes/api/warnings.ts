import { createFileRoute } from '@tanstack/react-router'
import { denyUnless, numberParam } from '#/server/grid/http.ts'
import { listWarnings } from '#/server/grid/queries.ts'
import { ensureGridRunning } from '#/server/grid/runtime.ts'

/** Early-warning log, with confirmation and lead time. */
export const Route = createFileRoute('/api/warnings')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const denied = denyUnless()
        if (denied) return denied
        ensureGridRunning()
        return Response.json(listWarnings(numberParam(new URL(request.url).searchParams.get('limit'), 100, 500)))
      },
    },
  },
})
