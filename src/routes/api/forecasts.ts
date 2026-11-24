import { createFileRoute } from '@tanstack/react-router'
import { currentForecasts } from '#/server/grid/forecaster.ts'
import { ensureGridRunning } from '#/server/grid/runtime.ts'

/** Active forecasts: metrics heading for a hard limit, with ETA. */
export const Route = createFileRoute('/api/forecasts')({
  server: {
    handlers: {
      GET: () => {
        ensureGridRunning()
        return Response.json(currentForecasts())
      },
    },
  },
})
