import { createFileRoute } from '@tanstack/react-router'
import { NodesTabPage } from '#/dashboard/Overview.tsx'

/** Nodes tab: every node with its town and a meter per metric. */
export const Route = createFileRoute('/_app/nodes/')({
  component: () => (
    <div className="grid-ui">
      <NodesTabPage />
    </div>
  ),
})
