import { useState } from 'react'
import { Link, createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, LoaderCircle, ScrollText, ShieldCheck, Sparkles, Split, Trash2, UserRound } from 'lucide-react'
import { EchoForm } from '#/components/EchoForm.tsx'
import { AetherBadge } from '#/components/AetherBadge.tsx'
import { StabilizeGame } from '#/components/StabilizeGame.tsx'
import { StatusStepper } from '#/components/StatusStepper.tsx'
import { PixelAvatar } from '#/components/grid/PixelAvatar.tsx'
import { PixelIcon } from '#/components/grid/PixelIcon.tsx'
import { GlitchTypeBadge } from '#/components/GlitchTypeBadge.tsx'
import { generateRunbook, splitEcho } from '#/lib/ai.functions.ts'
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
  type AiNote,
  type Echo,
  type RunbookStep,
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
    <Link to="/glitches" className="back-link">
      <ArrowLeft className="size-4" />
      All glitches
    </Link>
  )
}

function GlitchPage() {
  const glitch = Route.useLoaderData()
  const { guardian } = Route.useRouteContext()
  const router = useRouter()
  const isAssignee = glitch.assigneeId === guardian.guardianId

  return (
    <div className="glitch-page">
      <header className="grid-ui glitch-head">
        <BackLink />
        <span className="ribbon">Glitch {glitch.glitchId}</span>
        <h1 className="glitch-title">{glitch.description}</h1>
        <div className="glitch-facts">
          <span className={`status-chip status-${glitch.status.toLowerCase()}`}>
            <span className={`glitch-dot status-${glitch.status.toLowerCase()}`} />
            {STATUS_LABELS[glitch.status]}
          </span>
          <GlitchTypeBadge type={glitch.glitchType} />
          <span className="who">
            {glitch.assignee ? (
              <>
                <PixelAvatar codename={glitch.assignee} size={22} />
                Assigned to <strong>{glitch.assignee}</strong>
                {isAssignee && <span className="you-tag">you</span>}
              </>
            ) : (
              <>
                <UserRound className="size-4" />
                Unassigned
              </>
            )}
          </span>
          <span className="muted">
            Leaked on{' '}
            <time dateTime={glitch.timestamp} suppressHydrationWarning>
              {formatTimestamp(glitch.timestamp)}
            </time>
          </span>
          <span className="muted">
            {glitch.echoes.length} echo{glitch.echoes.length === 1 ? '' : 'es'}
          </span>
        </div>
      </header>

      <div className="card glitch-stepper">
        <StatusStepper status={glitch.status} />
      </div>

      {glitch.status === 'CONTAINING' && (
        <StabilizeGame
          seed={glitch.glitchId}
          onStabilize={(proof, run) => stabilizeGlitch({ data: { glitchId: glitch.glitchId, proof, run } })}
          onDone={() => router.invalidate()}
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

      <div className="glitch-columns has-side">
        <section className="card glitch-story">
          <div className="card-title section-title">
            <PixelIcon name="rift" size={18} />
            Echoes &amp; history
          </div>

          <Timeline glitch={glitch} canSplit={isCommander(guardian)} />

          <div className="echo-box">
            <h3>{isAssignee ? 'Send an update on your glitch' : 'Add an echo to this glitch'}</h3>
            <EchoForm
              glitchId={glitch.glitchId}
              placeholder="Any update? What changed, what did you try?"
              onReported={() => router.invalidate()}
            />
          </div>
        </section>

        {(
          <aside className="glitch-side">
            <RunbookCard glitch={glitch} />
            {isAssignee && <AssigneePanel glitch={glitch} />}
            {isCommander(guardian) && <CommanderPanel glitch={glitch} defenders={glitch.defenders} />}
          </aside>
        )}
      </div>
    </div>
  )
}

// ---------- timeline: echoes and history in time order ----------

type TimelineItem =
  | { kind: 'echo'; at: string; echo: Echo }
  | { kind: 'event'; at: string; event: GlitchEvent }
  | { kind: 'ai'; at: string; note: AiNote }

function Timeline({ glitch, canSplit }: { glitch: GlitchDetail; canSplit: boolean }) {
  const items: TimelineItem[] = [
    ...glitch.echoes.map((echo) => ({ kind: 'echo' as const, at: echo.timestamp, echo })),
    ...glitch.events.map((event) => ({ kind: 'event' as const, at: event.timestamp, event })),
    ...glitch.aiNotes.map((note) => ({ kind: 'ai' as const, at: note.timestamp, note })),
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
            canSplit={canSplit && item.echo.timestamp !== glitch.timestamp}
          />
        ) : item.kind === 'ai' ? (
          <AiNoteItem key={`ai-${item.note.noteId}`} note={item.note} />
        ) : (
          <EventItem key={`event-${item.event.eventId}`} event={item.event} />
        ),
      )}
    </ol>
  )
}

function EchoItem({ echo, opened, canSplit }: { echo: Echo; opened: boolean; canSplit: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const split = async () => {
    if (!confirm('Move this echo out into a new glitch of its own?')) return
    setBusy(true)
    try {
      const { glitchId } = await splitEcho({ data: echo.echoId })
      await router.navigate({ to: '/glitches/$glitchId', params: { glitchId } })
    } finally {
      setBusy(false)
    }
  }
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
      {canSplit && (
        <button type="button" className="split-btn" onClick={split} disabled={busy} title="Commander: this echo is about something else, give it its own glitch">
          <Split className="size-3.5" />
          Split into new glitch
        </button>
      )}
    </li>
  )
}

/** Something the AI (or its offline rules) did to this glitch. */
function AiNoteItem({ note }: { note: AiNote }) {
  return (
    <li className="relative ai-note">
      <span className="absolute top-1 -left-[31px] ai-note-dot">
        <Sparkles className="size-3" />
      </span>
      <p className="text-sm">
        <span className={`ai-tag source-${note.source}`}>{note.source === 'ai' ? 'AI' : 'Rules'}</span> {note.message} ·{' '}
        <span className="text-muted">
          <Time iso={note.timestamp} />
        </span>
      </p>
    </li>
  )
}

/** Step-by-step plan for this glitch, written by the AI on request (or a per-type template offline). */
function RunbookCard({ glitch }: { glitch: GlitchDetail }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const steps: RunbookStep[] = glitch.runbook ? JSON.parse(glitch.runbook) : []

  const write = async () => {
    setBusy(true)
    setError(null)
    try {
      await generateRunbook({ data: glitch.glitchId })
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not write the runbook')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card runbook">
      <div className="card-title section-title">
        <ScrollText className="size-4" />
        Runbook
        {glitch.runbookSource && (
          <span className={`ai-tag source-${glitch.runbookSource}`}>{glitch.runbookSource === 'ai' ? 'AI' : 'Rules'}</span>
        )}
      </div>
      {steps.length > 0 ? (
        <ol className="runbook-steps">
          {steps.map((step, i) => (
            <li key={i}>
              <span className="runbook-num">{i + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">No runbook yet. Let the AI write a step plan for this glitch.</p>
      )}
      <button type="button" className="runbook-btn" onClick={write} disabled={busy}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {busy ? 'Writing…' : steps.length ? 'Rewrite runbook' : 'Write runbook'}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
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
