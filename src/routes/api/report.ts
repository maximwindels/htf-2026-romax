import { createFileRoute } from '@tanstack/react-router'
import { getSessionGuardian } from '#/lib/auth.server.ts'
import { denyUnless } from '#/server/grid/http.ts'
import { ensureGridRunning } from '#/server/grid/runtime.ts'
import { renderReport, reportFileName } from '#/server/report/render.tsx'

/** GET /api/report - PDF report for the High Council. Every logged-in guardian may export it. */
export const Route = createFileRoute('/api/report')({
  server: {
    handlers: {
      GET: async () => {
        const denied = denyUnless()
        if (denied) return denied
        ensureGridRunning()
        const pdf = await renderReport(getSessionGuardian()!)
        return new Response(new Uint8Array(pdf), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${reportFileName()}"`,
            'Cache-Control': 'no-store',
          },
        })
      },
    },
  },
})
