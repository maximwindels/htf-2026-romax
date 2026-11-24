import { createFileRoute } from '@tanstack/react-router'
import { denyUnless } from '#/server/grid/http.ts'
import { currentForecasts } from '#/server/grid/forecaster.ts'
import { ensureGridRunning } from '#/server/grid/runtime.ts'

/** Active forecasts: metrics heading for a hard limit, with ETA. */
export const Route = createFileRoute('/api/forecasts')({
  server: {
    handlers: {
      GET: () => {
        const denied = denyUnless()
        if (denied) return denied
        ensureGridRunning()
        return Response.json(currentForecasts())
      },
    },
  },
})
