import { useRouter } from '@tanstack/react-router'
import { ChevronRight, MessageSquare } from 'lucide-react'
import { StatusBadge } from '#/components/StatusBadge.tsx'
import type { GlitchListItem } from '#/lib/glitch.ts'
import { formatTimestamp } from '#/lib/format.ts'

const columns = ['ID', 'Status', 'Description', 'Echoes', 'Timestamp', '']

export function GlitchesTable({ glitches }: { glitches: GlitchListItem[] }) {
  const router = useRouter()

  if (glitches.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
        No glitches. Achrona is calm, for now.
      </p>
    )
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead>
            <tr className="border-b-2 border-line text-muted">
              {columns.map((col, i) => (
                <th key={i} className="px-5 py-4 font-normal">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-fg">
            {glitches.map((glitch) => {
              const open = () =>
                router.navigate({ to: '/glitches/$glitchId', params: { glitchId: glitch.glitchId } })
              return (
                <tr
                  key={glitch.glitchId}
                  data-glitch-row
                  tabIndex={0}
                  onClick={open}
                  onKeyDown={(e) => e.key === 'Enter' && open()}
                  className="cursor-pointer transition-colors hover:bg-subtle focus:bg-subtle focus:outline-none focus-visible:shadow-[inset_4px_0_0_var(--accent)]"
                >
                  <td className="px-5 py-4 whitespace-nowrap">{glitch.glitchId}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={glitch.status} />
                  </td>
                  <td className="px-5 py-4">{glitch.description}</td>
                  <td className="px-5 py-4 text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <MessageSquare className="size-4" strokeWidth={1.75} />
                      {glitch.echoCount}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    {/* Server and browser time zones can differ; the browser's wins. */}
                    <time dateTime={glitch.timestamp} suppressHydrationWarning>
                      {formatTimestamp(glitch.timestamp)}
                    </time>
                  </td>
                  <td className="px-5 py-4 text-muted">
                    <ChevronRight className="size-5" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
