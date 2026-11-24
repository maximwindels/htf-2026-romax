import {useState} from 'react'
import {createFileRoute} from '@tanstack/react-router'
import {Plus} from 'lucide-react'
import {GlitchesTable} from '#/components/GlitchesTable.tsx'
import {ReportEchoDialog} from '#/components/ReportEchoDialog.tsx'
import {OverviewPage as MissionControl} from '#/dashboard/Overview.tsx'
import {getGlitches} from '#/lib/glitches.functions.ts'

export const Route = createFileRoute('/_app/')({
  loader: () => getGlitches(),
  component: OverviewPage,
})

/** Overview: live mission control on top, the guardians' glitch list below. */
function OverviewPage() {
  // Auto-opened glitches reload this loader through the live stream (see dashboard/live.ts).
  const glitches = Route.useLoaderData()
  const [reporting, setReporting] = useState(false)

  return (
    <div className="flex flex-col gap-8">
      <div className="grid-ui">
        <MissionControl />
      </div>
      <section className="glitches-section flex flex-col gap-4">
        <div className="grid-ui flex items-center justify-between gap-4">
          <h2>Glitches</h2>
          {/* Every guardian (defender and commander) may report an echo. */}
          <button type="button" onClick={() => setReporting(true)} className="inline-flex items-center gap-2">
            <Plus className="size-4" />
            Report echo
          </button>
        </div>
        <GlitchesTable glitches={glitches} />
      </section>
      <ReportEchoDialog open={reporting} onClose={() => setReporting(false)} />
    </div>
  )
}
