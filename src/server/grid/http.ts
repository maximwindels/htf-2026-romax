/** Small helpers for the /api route handlers. */
import { getSessionGuardian } from '#/lib/auth.server.ts'
import type { Metric } from '#/lib/grid.ts'
import { isCommander, type GuardianRole } from '#/lib/guardian.ts'

/** Read a number from the query string, with a default and a maximum. */
export function numberParam(raw: string | null, fallback: number, max: number) {
  return Math.min(Number(raw) || fallback, max)
}

/** Optional { nodeId, metric } body; missing or invalid means "pick a random one". */
export type Target = { nodeId?: string; metric?: Metric }
export function readTarget(request: Request): Promise<Target> {
  return request.json().catch(() => ({})) as Promise<Target>
}

/**
 * Role check for the /api routes, with Maxim's session login (src/lib/auth.server.ts).
 * Returns an error response when the request may not continue, or null when it may.
 * - no role: any logged-in guardian (defender or commander)
 * - 'commander': admin rights, like the demo controls that inject trouble
 */
export function denyUnless(role?: GuardianRole): Response | null {
  const guardian = getSessionGuardian()
  if (!guardian) return Response.json({ error: 'Not logged in' }, { status: 401 })
  if (role === 'commander' && !isCommander(guardian)) {
    return Response.json({ error: 'Commander rights required' }, { status: 403 })
  }
  return null
}
