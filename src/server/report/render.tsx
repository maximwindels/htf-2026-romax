/** Turns the current state of the grid into the High Council PDF. */
import { renderToBuffer } from '@react-pdf/renderer'
import type { Guardian } from '#/lib/guardian.ts'
import { collectReportData } from './data'
import { ReportDocument } from './ReportDocument'
import { registerFonts } from './theme'

export async function renderReport(guardian: Guardian): Promise<Buffer> {
  registerFonts()
  return renderToBuffer(<ReportDocument data={collectReportData(guardian)} />)
}

/** "achrona-report-2026-11-24-1042.pdf" (local time of the server). */
export function reportFileName(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return `achrona-report-${date}-${pad(now.getHours())}${pad(now.getMinutes())}.pdf`
}
