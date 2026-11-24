import { createFileRoute } from '@tanstack/react-router'
import { AnomaliesPage } from '#/dashboard/Anomalies.tsx'

/** Anomaly log: every flagged reading, with sorting, search, filters and acknowledge. */
export const Route = createFileRoute('/anomalies')({
  component: () => (
    <div className="grid-ui">
      <AnomaliesPage />
    </div>
  ),
})
