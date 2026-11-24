import {createFileRoute, useNavigate} from '@tanstack/react-router'
import {Plus} from 'lucide-react'
import {GlitchesTable} from '#/components/GlitchesTable.tsx'
import {ReportEchoDialog} from '#/components/ReportEchoDialog.tsx'
import {OverviewPage as MissionControl} from '#/dashboard/Overview.tsx'
import {getGlitches} from '#/lib/glitches.functions.ts'

type OverviewSearch = {
  /** Open the "report echo" dialog (the N shortcut links here). */
  report?: boolean
}

export const Route = createFileRoute('/_app/')({
  validateSearch: (search: Record<string, unknown>): OverviewSearch => ({
    report: search.report === true || search.report === 'true' ? true : undefined,
  }),
  loader: () => getGlitches(),
  component: OverviewPage,
})

/** Overview: live mission control on top, the guardians' glitch list below. */
function OverviewPage() {
  // Auto-opened glitches reload this loader through the live stream (see dashboard/live.ts).
  const glitches = Route.useLoaderData()
  // The dialog state lives in the URL, so the N shortcut can open it from any page.
  const { report } = Route.useSearch()
  const navigate = useNavigate({ from: '/' })
  const setReporting = (open: boolean) =>
    navigate({ search: open ? { report: true } : {}, replace: !open })

  return (
    <div className="flex flex-col gap-8">
      <div className="grid-ui">
        <MissionControl />
      </div>
      <section className="glitches-section flex flex-col gap-4">
        <div className="grid-ui flex items-center justify-between gap-4">
          <h2>Glitches</h2>
          {/* Every guardian (defender and commander) may report an echo. */}
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="inline-flex items-center gap-2"
            title="Report echo (N)"
          >
            <Plus className="size-4" />
            Report echo
          </button>
        </div>
        <GlitchesTable glitches={glitches} />
      </section>
      <ReportEchoDialog open={!!report} onClose={() => setReporting(false)} />
    </div>
  )
}
