import { createFileRoute } from '@tanstack/react-router'
import { MapTabPage } from '#/dashboard/Overview.tsx'

/** Map tab: the realm with its towns, ley lines and corruption, as big as it gets. */
export const Route = createFileRoute('/_app/map')({
  component: () => (
    <div className="grid-ui">
      <MapTabPage />
    </div>
  ),
})
