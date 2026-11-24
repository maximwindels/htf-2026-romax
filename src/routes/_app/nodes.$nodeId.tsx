import { createFileRoute } from '@tanstack/react-router'
import { NodeDetailPage } from '#/dashboard/NodeDetail.tsx'

/** One node: its four charts with forecasts, its warnings and alerts, and demo buttons. */
export const Route = createFileRoute('/_app/nodes/$nodeId')({
  component: () => (
    <div className="grid-ui">
      <NodeDetailPage />
    </div>
  ),
})
