/**
 * Starts the live grid once per server process: seed the nodes, run the data source, clean old readings.
 * Every /api route calls ensureGridRunning(), so the simulator starts with the first request.
 */
import { lt, sql } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { nodes, readings } from '#/db/schema.ts'
import { NODES } from './nodes'
import { startSimulator } from './simulator'

const RETENTION_HOURS = 2

type Runtime = { timers: NodeJS.Timeout[] }
const g = globalThis as typeof globalThis & { __gridRuntime?: Runtime }

export function ensureGridRunning() {
  if (g.__gridRuntime) return
  assertTablesExist()
  db.insert(nodes).values(NODES).onConflictDoNothing().run()
  g.__gridRuntime = { timers: [startSimulator(), startRetention()] }
  console.log('[grid] simulator running')
}

/** In dev, a hot reload of this file stops the old loop so the new code takes over (no double ticks). */
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    g.__gridRuntime?.timers.forEach(clearInterval)
    g.__gridRuntime = undefined
  })
}

/** Keep the readings table small: the dashboard only shows recent history. */
function startRetention() {
  return setInterval(() => {
    const cutoff = Date.now() - RETENTION_HOURS * 3_600_000
    db.delete(readings).where(lt(readings.ts, cutoff)).run()
  }, 60_000)
}

function assertTablesExist() {
  const found = db.get<{ n: number }>(sql`select count(*) as n from sqlite_master where type = 'table' and name = 'readings'`)
  if (!found?.n) throw new Error('Grid tables are missing. Run `npm run db:setup` (drizzle-kit push + seed) first.')
}
