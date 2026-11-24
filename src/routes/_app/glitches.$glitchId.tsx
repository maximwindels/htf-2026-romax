import { useState } from 'react'
import { Link, createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { ArrowLeft, LoaderCircle, ShieldCheck, Trash2 } from 'lucide-react'
import { EchoForm } from '#/components/EchoForm.tsx'
import { Stabilizer } from '#/components/Stabilizer.tsx'
import { StatusBadge } from '#/components/StatusBadge.tsx'
import { playStabilized } from '#/dashboard/sound.ts'
import { formatTimestamp } from '#/lib/format.ts'
import { deleteGlitch, getGlitch, setGlitchStatus, stabilizeGlitch } from '#/lib/glitches.functions.ts'
import { GLITCH_STATUSES, STATUS_LABELS, type GlitchDetail, type GlitchStatus } from '#/lib/glitch.ts'
import { isCommander } from '#/lib/guardian.ts'

export const Route = createFileRoute('/_app/glitches/$glitchId')({
  loader: async ({ params }) => {
    const glitch = await getGlitch({ data: params.glitchId })
    if (!glitch) throw notFound()
    return glitch
  },
  head: ({ params }) => ({ meta: [{ title: `${params.glitchId} · Control Center` }] }),
  component: GlitchPage,
  notFoundComponent: () => (
    <div className="flex flex-col items-start gap-4">
      <BackLink />
      <p className="text-muted">This glitch doesn't exist (anymore).</p>
    </div>
  ),
})

function BackLink() {
  return (
    <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
      <ArrowLeft className="size-4" />
      Overview
    </Link>
  )
}

function GlitchPage() {
  const glitch = Route.useLoaderData()
  const { guardian } = Route.useRouteContext()
  const router = useRouter()

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackLink />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-muted">{glitch.glitchId}</span>
          <StatusBadge status={glitch.status} />
        </div>
        <h1 className="text-3xl font-semibold text-fg">{glitch.description}</h1>
        <p className="text-sm text-muted">
          Leaked on{' '}
          <time dateTime={glitch.timestamp} suppressHydrationWarning>
            {formatTimestamp(glitch.timestamp)}
          </time>
        </p>
      </div>

      {glitch.status === 'CONTAINING' && (
        <Stabilizer
          seed={glitch.glitchId}
          onStabilize={(signal) => stabilizeGlitch({ data: { glitchId: glitch.glitchId, ...signal } })}
          onDone={() => router.invalidate()}
          doneLabel="Signal stabilized · glitch fixed"
          hint={
            <>
              Tune your signal onto the ghost wave and hold it steady for 2 seconds. Press{' '}
              <kbd className="kbd">S</kbd> to grab the controls.
            </>
          }
        />
      )}

      {isCommander(guardian) && <CommanderPanel glitch={glitch} />}

      <section className="flex flex-col gap-5">
        <h2 className="text-lg font-semibold text-fg">
          Echoes <span className="font-normal text-muted">({glitch.echoes.length})</span>
        </h2>

        <ol className="relative flex flex-col gap-5 border-l-2 border-line pl-6">
          {glitch.echoes.map((echo, i) => (
            <li key={echo.echoId} className="relative">
              <span
                className={`absolute top-1.5 -left-[31px] size-3 rounded-full border-2 border-app ${i === 0 ? 'bg-red-500' : 'bg-accent'}`}
              />
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-semibold text-fg">{echo.reporter}</span>
                <span className="text-muted">
                  {i === 0 ? 'reported the glitch' : 'sent an update'} ·{' '}
                  <time dateTime={echo.timestamp} suppressHydrationWarning>
                    {formatTimestamp(echo.timestamp)}
                  </time>
                </span>
              </div>
              <p className="mt-1 whitespace-pre-line text-fg">{echo.description}</p>
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border border-line p-5">
          <h3 className="mb-3 text-sm font-medium text-fg">Add an echo to this glitch</h3>
          <EchoForm
            glitchId={glitch.glitchId}
            placeholder="Any update? What changed, what did you try?"
            onReported={() => router.invalidate()}
          />
        </div>
      </section>
    </div>
  )
}

function CommanderPanel({ glitch }: { glitch: GlitchDetail }) {
  const router = useRouter()
  const [busy, setBusy] = useState<'status' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(kind: 'status' | 'delete', action: () => Promise<unknown>) {
    setError(null)
    setBusy(kind)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  const changeStatus = (status: GlitchStatus) =>
    run('status', async () => {
      await setGlitchStatus({ data: { glitchId: glitch.glitchId, status } })
      if (status === 'FIXED') playStabilized()
      await router.invalidate()
    })

  const remove = () => {
    if (!confirm(`Delete ${glitch.glitchId} and all its echoes? This can't be undone.`)) return
    return run('delete', async () => {
      await deleteGlitch({ data: glitch.glitchId })
      await router.invalidate()
      await router.navigate({ to: '/' })
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-accent/30 bg-accent/5 p-5">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
        <ShieldCheck className="size-4" />
        Commander controls
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted">Status</span>
        {GLITCH_STATUSES.map((status) => {
          const active = status === glitch.status
          return (
            <button
              key={status}
              type="button"
              disabled={active || busy !== null}
              onClick={() => changeStatus(status)}
              className={`h-9 rounded-lg px-3 text-sm transition-colors ${
                active
                  ? 'bg-accent font-medium text-white'
                  : 'border border-line bg-card text-fg hover:border-accent disabled:opacity-50'
              }`}
            >
              {STATUS_LABELS[status]}
            </button>
          )
        })}
        {busy === 'status' && <LoaderCircle className="size-4 animate-spin text-muted" />}

        <button
          type="button"
          onClick={remove}
          disabled={busy !== null}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-50"
        >
          <Trash2 className="size-4" />
          Delete glitch
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </section>
  )
}
