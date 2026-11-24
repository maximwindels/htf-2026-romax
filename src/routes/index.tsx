import {createFileRoute} from '@tanstack/react-router'
import {GlitchesTable} from '#/components/GlitchesTable.tsx'
import {OverviewPage} from '#/dashboard/Overview.tsx'
import {useGlitches} from '#/dashboard/hooks.ts'
import {getGlitches} from '#/lib/glitches.functions.ts'

export const Route = createFileRoute('/')({
  loader: () => getGlitches(),
  component: IndexPage,
})

/** Overview: live mission control on top, the guardians' glitch list below. */
function IndexPage() {
  // Loader data renders on the server; after that the live stream adds auto-opened glitches.
  const { data: glitches } = useGlitches(Route.useLoaderData())

  return (
    <div className="flex flex-col gap-8">
      <div className="grid-ui">
        <OverviewPage />
      </div>
      <section className="glitches-section flex flex-col gap-4">
        <div className="grid-ui">
          <h2>Glitches</h2>
        </div>
        <GlitchesTable glitches={glitches} />
      </section>
    </div>
  )
}
