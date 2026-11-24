import { useState, type FormEvent } from 'react'
import { LoaderCircle, Send } from 'lucide-react'
import { reportEcho } from '#/lib/glitches.functions.ts'
import { MAX_DESCRIPTION_LENGTH } from '#/lib/glitch.ts'

type EchoFormProps = {
  /** Omit to report a new glitch; set to add an update to an existing one. */
  glitchId?: string
  placeholder?: string
  submitLabel?: string
  autoFocus?: boolean
  onReported: (result: { glitchId: string; echoId: string }) => void | Promise<void>
}

export function EchoForm({
  glitchId,
  placeholder = 'What did you notice?',
  submitLabel = 'Send echo',
  autoFocus,
  onReported,
}: EchoFormProps) {
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      const result = await reportEcho({ data: { description, glitchId } })
      setDescription('')
      await onReported(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send echo')
    } finally {
      setPending(false)
    }
  }

  const remaining = MAX_DESCRIPTION_LENGTH - description.length

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-3">
      <textarea
        aria-label="Echo description"
        required
        rows={3}
        maxLength={MAX_DESCRIPTION_LENGTH}
        autoFocus={autoFocus}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          // Ctrl/Cmd + Enter submits.
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit()
        }}
        placeholder={placeholder}
        className="w-full resize-y rounded-xl border border-line bg-subtle px-3 py-2.5 text-fg outline-none transition-colors placeholder:text-muted focus:border-accent focus:bg-white"
      />

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs ${remaining < 50 ? 'text-red-600' : 'text-muted'}`}>
          {remaining} characters left · Ctrl+Enter to send
        </span>
        <button
          type="submit"
          disabled={pending || !description.trim()}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-linear-to-br from-accent-from to-accent-to px-4 text-sm font-medium text-white shadow-md shadow-glow transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
