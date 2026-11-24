import {useState} from 'react'
import {createFileRoute} from '@tanstack/react-router'
import {Plus} from 'lucide-react'
import {GlitchesTable} from '#/components/GlitchesTable.tsx'
import {ReportEchoDialog} from '#/components/ReportEchoDialog.tsx'
import {getGlitches} from '#/lib/glitches.functions.ts'

export const Route = createFileRoute('/_app/')({
  loader: () => getGlitches(),
  component: OverviewPage,
})

function OverviewPage() {
  const glitches = Route.useLoaderData()
  const [reporting, setReporting] = useState(false)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold text-fg">Overview</h1>
        <button
          type="button"
          onClick={() => setReporting(true)}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-linear-to-br from-accent-from to-accent-to px-5 font-medium text-white shadow-md shadow-glow transition-opacity hover:opacity-90"
        >
          <Plus className="size-5" />
          Report echo
        </button>
      </div>
      <GlitchesTable glitches={glitches} />
      <ReportEchoDialog open={reporting} onClose={() => setReporting(false)} />
    </div>
  )
}
