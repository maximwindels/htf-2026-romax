import { createFileRoute } from '@tanstack/react-router'
import { getSessionGuardian } from '#/lib/auth.server.ts'
import { resolveAutoGlitches } from '#/lib/autoGlitches.server.ts'
import { parseRunMeta } from '#/lib/games.ts'
import { recordRun } from '#/lib/games.server.ts'
import { anomalySeed, parseProof, verifyProof } from '#/lib/stabilize.ts'
import { denyUnless } from '#/server/grid/http.ts'
import { acknowledgeIncident, getAnomaly } from '#/server/grid/queries.ts'

/**
 * POST /api/anomalies/:id/ack - every open dashboard gets an `ack` event.
 * Acknowledging clears the whole incident: every open alert of the same node + metric
 * (a glitch fires an alert every second it lasts).
 * Critical anomalies can't just be clicked away: the body must carry proof of a won mini-game,
 * `{ kind: 'tune', frequency, phase }` or `{ kind: 'pulse', offsetsMs }`.
 */
export const Route = createFileRoute('/api/anomalies/$id/ack')({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const denied = denyUnless()
        if (denied) return denied

        const id = Number(params.id)
        const existing = getAnomaly(id)
        if (!existing) return Response.json({ error: 'not found' }, { status: 404 })
        if (existing.acknowledgedAt) return Response.json(existing)

        if (existing.severity === 'critical') {
          // Proof of a won mini-game: a tuned signal or two pulse hits (see lib/stabilize.ts),
          // plus `run` (time taken, flawless) for the leaderboard.
          const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
          const proof = parseProof(body)
          if (!proof || !verifyProof(anomalySeed(id), proof)) {
            return Response.json(
              { error: 'Critical anomalies must be stabilized, not just acknowledged' },
              { status: 409 },
            )
          }
          const guardian = getSessionGuardian()
          if (guardian) {
            recordRun(guardian, { game: proof.kind, result: 'win', target: anomalySeed(id), ...parseRunMeta(body?.run) })
          }
        }

        acknowledgeIncident(existing.nodeId, existing.metric)
        // The auto-glitch this incident opened is fixed too, once all its alerts are cleared.
        const actor = getSessionGuardian()
        if (actor) resolveAutoGlitches(actor)
        return Response.json(getAnomaly(id))
      },
    },
  },
})
