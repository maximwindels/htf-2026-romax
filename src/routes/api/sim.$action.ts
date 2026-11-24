import { createFileRoute } from '@tanstack/react-router'
import { TROUBLE_MODES, type TroubleMode } from '#/lib/grid.ts'
import { bus } from '#/server/grid/bus.ts'
import { denyUnless, readTarget } from '#/server/grid/http.ts'
import { acknowledgeAllOpen } from '#/server/grid/queries.ts'
import { ensureGridRunning } from '#/server/grid/runtime.ts'
import {
  clearDisturbances,
  getTroubleMode,
  injectDesyncWave,
  injectGlitch,
  injectRamp,
  setTroubleMode,
} from '#/server/grid/simulator.ts'

/**
 * Demo controls: trigger trouble on stage.
 *   POST /api/sim/glitch {nodeId?, metric?}  sudden glitch
 *   POST /api/sim/ramp   {nodeId?, metric?}  slow build-up (the forecaster sees it coming)
 *   POST /api/sim/desync                     Desync wave
 *   GET  /api/sim/mode                       current trouble mode (any guardian)
 *   POST /api/sim/mode   {mode}              calm | normal | chaos: how much random trouble
 *   POST /api/sim/clear                      testing: stop all trouble and acknowledge every open anomaly
 */
export const Route = createFileRoute('/api/sim/$action')({
  server: {
    handlers: {
      GET: ({ params }) => {
        const denied = denyUnless()
        if (denied) return denied
        if (params.action !== 'mode') return Response.json({ error: 'unknown action' }, { status: 404 })
        return Response.json({ mode: getTroubleMode() })
      },
      POST: async ({ request, params }) => {
        const denied = denyUnless('commander')
        if (denied) return denied
        ensureGridRunning()

        if (params.action === 'mode') {
          const { mode } = (await request.json().catch(() => ({}))) as { mode?: TroubleMode }
          if (!mode || !TROUBLE_MODES.includes(mode)) {
            return Response.json({ error: `mode must be one of ${TROUBLE_MODES.join(', ')}` }, { status: 400 })
          }
          setTroubleMode(mode)
          bus.emit('mode', mode)
          return Response.json({ mode })
        }

        if (params.action === 'clear') {
          // Stop the running trouble first, or the next tick would raise the same alerts again.
          clearDisturbances()
          return Response.json({ acknowledged: acknowledgeAllOpen() })
        }

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
