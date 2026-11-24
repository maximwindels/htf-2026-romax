import { useRouteContext } from '@tanstack/react-router'
import { isCommander } from '#/lib/guardian.ts'

/** The logged-in guardian (from the /_app layout) and what their role allows on the dashboard. */
export function useGuardian() {
  const { guardian } = useRouteContext({ from: '/_app' })
  return {
    guardian,
    /** Commander only: the demo controls that inject trouble into the grid. */
    canControlSimulator: isCommander(guardian),
  }
}
