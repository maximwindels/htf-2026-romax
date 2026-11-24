import { useState } from 'react'
import { Link, createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, LoaderCircle, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { EchoForm } from '#/components/EchoForm.tsx'
import { AetherBadge } from '#/components/AetherBadge.tsx'
import { StabilizeGame } from '#/components/StabilizeGame.tsx'
import { StatusBadge } from '#/components/StatusBadge.tsx'
import { StatusStepper } from '#/components/StatusStepper.tsx'
import { playStabilized } from '#/dashboard/sound.ts'
import { formatTimestamp } from '#/lib/format.ts'
import {
  assignGlitch,
  deleteGlitch,
  getDefenders,
  getGlitch,
  setGlitchStatus,
  stabilizeGlitch,
} from '#/lib/glitches.functions.ts'
import {
  GLITCH_STATUSES,
  STATUS_LABELS,
  nextStatus,
  type Echo,
  type GlitchDetail,
  type GlitchEvent,
  type GlitchStatus,
} from '#/lib/glitch.ts'
import { isCommander, type Guardian } from '#/lib/guardian.ts'

export const Route = createFileRoute('/_app/glitches/$glitchId')({
  loader: async ({ params, context }) => {
    const glitch = await getGlitch({ data: params.glitchId })
    if (!glitch) throw notFound()
    // Only commanders assign glitches, so only they need the list of defenders.
    // Spread into the glitch: the keyboard shortcuts read this loader data as a GlitchDetail (J/K).
    const defenders = isCommander(context.guardian) ? await getDefenders() : []
    return { ...glitch, defenders }
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
  const isAssignee = glitch.assigneeId === guardian.guardianId
  /** The glitch whose mini-game was just won: keep showing it for a moment. */
  const [justWon, setJustWon] = useState<string | null>(null)

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackLink />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-muted">{glitch.glitchId}</span>
          <StatusBadge status={glitch.status} />
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <UserRound className="size-4" />
            {glitch.assignee ? (
              <>
                Assigned to <strong className="text-fg">{glitch.assignee}</strong>
                {isAssignee && ' (you)'}
              </>
            ) : (
              'Unassigned'
            )}
          </span>
        </div>
        <h1 className="text-3xl font-semibold text-fg">{glitch.description}</h1>
        <p className="text-sm text-muted">
          Leaked on{' '}
          <time dateTime={glitch.timestamp} suppressHydrationWarning>
            {formatTimestamp(glitch.timestamp)}
          </time>
        </p>
      </div>

      <StatusStepper status={glitch.status} />

      {/* Stays on screen after the win (the live stream flips the status to FIXED at once),
          so the success state and the "Flawless" line can be seen before it goes. */}
      {(glitch.status === 'CONTAINING' || justWon === glitch.glitchId) && (
        <StabilizeGame
          key={glitch.glitchId}
          seed={glitch.glitchId}
          onStabilize={async (proof, run) => {
            setJustWon(glitch.glitchId)
            try {
              return await stabilizeGlitch({ data: { glitchId: glitch.glitchId, proof, run } })
            } catch (err) {
              setJustWon(null)
              throw err
            }
          }}
          onDone={() =>
            setTimeout(() => {
              setJustWon(null)
              void router.invalidate()
            }, 2500)
          }
          doneLabel="Stabilized · glitch fixed"
          hints={{
            tune: (
              <>
                Tune your signal onto the ghost wave and hold it steady for 2 seconds. Press{' '}
                <kbd className="kbd">S</kbd> to grab the controls.
              </>
            ),
            pulse: (
              <>
                Press <kbd className="kbd">Space</kbd> or tap while the hand is inside the marked zone. Two hits in
                a row lock the timeline. Press <kbd className="kbd">S</kbd> to grab the pad.
              </>
            ),
          }}
        />
      )}

      {isAssignee && <AssigneePanel glitch={glitch} />}
      {isCommander(guardian) && <CommanderPanel glitch={glitch} defenders={glitch.defenders} />}

      <section className="flex flex-col gap-5">
        <h2 className="text-lg font-semibold text-fg">
          Echoes <span className="font-normal text-muted">({glitch.echoes.length})</span>
        </h2>

        <Timeline glitch={glitch} />

        <div className="rounded-2xl border border-line p-5">
          <h3 className="mb-3 text-sm font-medium text-fg">
            {isAssignee ? 'Send an update on your glitch' : 'Add an echo to this glitch'}
          </h3>
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

// ---------- timeline: echoes and history in time order ----------

type TimelineItem = { kind: 'echo'; at: string; echo: Echo } | { kind: 'event'; at: string; event: GlitchEvent }

function Timeline({ glitch }: { glitch: GlitchDetail }) {
  const items: TimelineItem[] = [
    ...glitch.echoes.map((echo) => ({ kind: 'echo' as const, at: echo.timestamp, echo })),
    ...glitch.events.map((event) => ({ kind: 'event' as const, at: event.timestamp, event })),
  ].sort((a, b) => a.at.localeCompare(b.at))

  if (items.length === 0) {
    return <p className="text-sm text-muted">No echoes yet. This glitch was opened by the system.</p>
  }

  return (
    <ol className="relative flex flex-col gap-5 border-l-2 border-line pl-6">
      {items.map((item) =>
        item.kind === 'echo' ? (
          <EchoItem
            key={`echo-${item.echo.echoId}`}
            echo={item.echo}
            // The echo that opened the glitch has the glitch's own timestamp.
            opened={item.echo.timestamp === glitch.timestamp}
          />
        ) : (
          <EventItem key={`event-${item.event.eventId}`} event={item.event} />
        ),
      )}
    </ol>
  )
}

function EchoItem({ echo, opened }: { echo: Echo; opened: boolean }) {
  return (
    <li className="relative">
      <span
        className={`absolute top-1.5 -left-[31px] size-3 rounded-full border-2 border-app ${opened ? 'bg-red-500' : 'bg-accent'}`}
      />
      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
          {echo.reporter}
          <AetherBadge guardianId={echo.reportingGuardianId} />
        </span>
        <span className="text-muted">
          {opened ? 'reported the glitch' : 'sent an update'} · <Time iso={echo.timestamp} />
        </span>
      </div>
      <p className="mt-1 whitespace-pre-line text-fg">{echo.description}</p>
    </li>
  )
}

/** A history line: smaller than an echo, so updates from guardians stay the main story. */
function EventItem({ event }: { event: GlitchEvent }) {
  const text =
    event.kind === 'status'
      ? `moved the status from ${label(event.fromValue)} to ${label(event.toValue)}`
      : event.toValue
        ? `assigned the glitch to ${event.toValue}`
        : `unassigned ${event.fromValue ?? 'the glitch'}`

  return (
    <li className="relative">
      <span className="absolute top-1.5 -left-[29px] size-2 bg-muted" />
      <p className="text-sm text-muted">
        <span className="font-semibold text-fg">{event.actor}</span> {text} · <Time iso={event.timestamp} />
      </p>
    </li>
  )
}

const label = (status: string | null) =>
  status && status in STATUS_LABELS ? STATUS_LABELS[status as GlitchStatus] : (status ?? '-')

function Time({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {formatTimestamp(iso)}
    </time>
  )
}

// ---------- shared action runner ----------

/** Runs one action at a time, with a busy flag and an error message. */
function useAction<K extends string>() {
  const [busy, setBusy] = useState<K | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(kind: K, action: () => Promise<unknown>) {
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

  return { busy, error, run }
}

function ErrorMessage({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-2 text-sm text-red-700 dark:text-red-300">
      {error}
    </p>
  )
}

// ---------- assigned defender ----------

/**
 * The defender this glitch is assigned to: send updates as echoes and move it one step forward.
 * The last step (Containing > Fixed) goes through the stabilizer, like for every guardian.
 */
function AssigneePanel({ glitch }: { glitch: GlitchDetail }) {
  const router = useRouter()
  const { busy, error, run } = useAction<'advance'>()
  const next = nextStatus(glitch.status)
  const canAdvance = next !== null && next !== 'FIXED'

  const advance = () =>
    next &&
    run('advance', async () => {
      await setGlitchStatus({ data: { glitchId: glitch.glitchId, status: next } })
      await router.invalidate()
    })

  const hint =
    next === null
      ? ' This glitch is fixed.'
      : next === 'FIXED'
        ? ' To fix it, stabilize the signal above.'
        : ' When the next step is reached, move the glitch forward.'

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-sky-400/30 bg-sky-400/5 p-5">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 dark:text-sky-300">
        <UserRound className="size-4" />
        Your assignment
      </h2>
      <p className="text-sm text-muted">
        Keep the council informed: send an echo below for every update.
        {hint}
      </p>
      {canAdvance && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={advance}
            disabled={busy !== null}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-linear-to-br from-accent-from to-accent-to px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            Move to {STATUS_LABELS[next]}
          </button>
        </div>
      )}
      <ErrorMessage error={error} />
    </section>
  )
}

// ---------- commander ----------

function CommanderPanel({ glitch, defenders }: { glitch: GlitchDetail; defenders: Guardian[] }) {
  const router = useRouter()
  const { busy, error, run } = useAction<'status' | 'assign' | 'delete'>()

  const changeStatus = (status: GlitchStatus) =>
    run('status', async () => {
      await setGlitchStatus({ data: { glitchId: glitch.glitchId, status } })
      if (status === 'FIXED') playStabilized()
      await router.invalidate()
    })

  const assign = (guardianId: string | null) =>
    run('assign', async () => {
      await assignGlitch({ data: { glitchId: glitch.glitchId, guardianId } })
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
        <span className="mr-1 w-20 text-sm text-muted">Assign to</span>
        <select
          aria-label="Assign to defender"
          value={glitch.assigneeId ?? ''}
          disabled={busy !== null}
          onChange={(e) => assign(e.target.value || null)}
          className="h-9 rounded-lg border border-line bg-card px-3 text-sm text-fg disabled:opacity-50"
        >
          <option value="">Nobody (unassigned)</option>
          {defenders.map((d) => (
            <option key={d.guardianId} value={d.guardianId}>
              {d.codename}
            </option>
          ))}
        </select>
        {busy === 'assign' && <LoaderCircle className="size-4 animate-spin text-muted" />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 w-20 text-sm text-muted">Status</span>
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

      <ErrorMessage error={error} />
    </section>
  )
}
