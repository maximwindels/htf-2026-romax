import { createFileRoute } from '@tanstack/react-router'
import { VitalsTabPage } from '#/dashboard/Overview.tsx'

/** Vitals tab: the four live charts in full. */
export const Route = createFileRoute('/_app/vitals')({
  component: () => (
    <div className="grid-ui">
      <VitalsTabPage />
    </div>
  ),
})
