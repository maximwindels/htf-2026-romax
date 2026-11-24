import { createFileRoute } from '@tanstack/react-router'
import { readTarget } from '#/server/grid/http.ts'
import { ensureGridRunning } from '#/server/grid/runtime.ts'
import { injectDesyncWave, injectGlitch, injectRamp } from '#/server/grid/simulator.ts'

/**
 * Demo controls: trigger trouble on stage.
 *   POST /api/sim/glitch {nodeId?, metric?}  sudden glitch
 *   POST /api/sim/ramp   {nodeId?, metric?}  slow build-up (the forecaster sees it coming)
 *   POST /api/sim/desync                     Desync wave
 */
export const Route = createFileRoute('/api/sim/$action')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        ensureGridRunning()
        const { nodeId, metric } = await readTarget(request)
        switch (params.action) {
          case 'glitch':
            return Response.json(injectGlitch(nodeId, metric))
          case 'ramp':
            return Response.json(injectRamp(nodeId, metric))
          case 'desync':
            return Response.json(injectDesyncWave())
          default:
            return Response.json({ error: 'unknown action' }, { status: 404 })
        }
      },
    },
  },
})
