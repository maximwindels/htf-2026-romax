import { useState, type FormEvent } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { Activity, KeyRound, LoaderCircle, UserRound } from 'lucide-react'
import { getCurrentGuardian, login } from '#/lib/auth.functions.ts'

type LoginSearch = { redirect?: string }

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: async () => {
    // Already logged in: nothing to do here.
    if (await getCurrentGuardian()) throw redirect({ to: '/' })
  },
  head: () => ({ meta: [{ title: 'Login · Control Center' }] }),
  component: LoginPage,
})

/** Only follow same-site paths, never `//evil.com` or full URLs. */
function safeRedirect(target: string | undefined) {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : '/'
}

function LoginPage() {
  const router = useRouter()
  const { redirect: redirectTo } = Route.useSearch()
  const [codename, setCodename] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      await login({ data: { codename, password } })
      await router.invalidate()
      await router.navigate({ href: safeRedirect(redirectTo), replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setPending(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sidebar px-4">
      {/* Background glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-accent/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-24 size-[420px] rounded-full bg-accent-from/20 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-accent-from to-accent-to text-white shadow-lg shadow-black/40">
            <Activity className="size-8" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Guardians of the Grid</h1>
            <p className="mt-1 text-sm text-white/60">Identify yourself to enter mission control</p>
          </div>
        </div>

        {/* method="post": a submit before hydration must never put the password in the URL. */}
        <form
          method="post"
          onSubmit={onSubmit}
          className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/40"
        >
          <Field
            id="codename"
            label="Codename"
            icon={UserRound}
            value={codename}
            onChange={setCodename}
            autoComplete="username"
            autoFocus
          />
          <Field
            id="password"
            label="Password"
            type="password"
            icon={KeyRound}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-linear-to-br from-accent-from to-accent-to font-medium text-white shadow-md shadow-glow transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            {pending ? 'Verifying…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  )
}

type FieldProps = {
  id: string
  label: string
  icon: typeof UserRound
  value: string
  onChange: (value: string) => void
  type?: string
  autoComplete?: string
  autoFocus?: boolean
}

function Field({ id, label, icon: Icon, value, onChange, type = 'text', ...rest }: FieldProps) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-fg">{label}</span>
      <span className="flex h-11 items-center gap-2 rounded-xl border border-line bg-subtle px-3 transition-colors focus-within:border-accent focus-within:bg-white">
        <Icon className="size-4 text-muted" strokeWidth={1.75} />
        <input
          id={id}
          name={id}
          type={type}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-muted"
          {...rest}
        />
      </span>
    </label>
  )
}
