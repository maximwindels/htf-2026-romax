import { useEffect, useRef } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Radio, X } from 'lucide-react'
import { EchoForm } from '#/components/EchoForm.tsx'

type Props = { open: boolean; onClose: () => void }

/** Modal for reporting a new echo, which opens a new glitch. */
export function ReportEchoDialog({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const router = useRouter()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal() picks its own focus target; put the cursor in the textarea instead.
      dialog.querySelector('textarea')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-full max-w-lg rounded-3xl border border-line bg-white p-0 shadow-2xl backdrop:bg-sidebar/60 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="flex flex-col gap-5 p-7">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Radio className="size-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-fg">Report an echo</h2>
              <p className="text-sm text-muted">
                Every new echo opens a glitch with status <strong>Leaked</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-muted transition-colors hover:text-fg"
            >
              <X className="size-5" />
            </button>
          </div>

          <EchoForm
            placeholder="e.g. Clock tower bells ringing backwards since 14:00"
            onReported={async ({ glitchId }) => {
              onClose()
              await router.invalidate()
              await router.navigate({ to: '/glitches/$glitchId', params: { glitchId } })
            }}
          />
        </div>
      )}
    </dialog>
  )
}
