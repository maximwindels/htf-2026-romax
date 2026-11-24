/** Small helpers for the /api route handlers. */
import type { Metric } from '#/lib/grid.ts'

/** Read a number from the query string, with a default and a maximum. */
export function numberParam(raw: string | null, fallback: number, max: number) {
  return Math.min(Number(raw) || fallback, max)
}

/** Optional { nodeId, metric } body; missing or invalid means "pick a random one". */
export type Target = { nodeId?: string; metric?: Metric }
export function readTarget(request: Request): Promise<Target> {
  return request.json().catch(() => ({})) as Promise<Target>
}
