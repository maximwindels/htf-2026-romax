import { useState, type FormEvent } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { KeyRound, LoaderCircle, UserRound } from 'lucide-react'
import { PixelCrystal } from '#/components/grid/PixelCrystal'
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
    // grid-ui: same "Curse of Achrona" theme as the dashboard (src/grid.css).
    <div className="grid-ui flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <PixelCrystal size={64} />
          <span className="ribbon">Guardians of the Grid</span>
          <h1 className="justify-center">Achrona</h1>
          <p className="muted">Identify yourself to enter mission control</p>
        </div>

        {/* method="post": a submit before hydration must never put the password in the URL. */}
        <form method="post" onSubmit={onSubmit} className="card flex flex-col gap-5 p-7">
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
            <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 inline-flex items-center justify-center gap-2"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            {pending ? 'Verifying…' : 'Enter mission control'}
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
      <span className="field-label">{label}</span>
      <span className="flex h-11 items-center gap-2 rounded-[10px] border border-line bg-subtle px-3 transition-colors focus-within:border-accent">
        <Icon className="size-4 text-muted" strokeWidth={1.75} />
        <input
          id={id}
          name={id}
          type={type}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 text-fg outline-none placeholder:text-muted"
          {...rest}
        />
      </span>
    </label>
  )
}
