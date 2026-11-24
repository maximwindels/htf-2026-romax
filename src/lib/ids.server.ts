// Server-only: touches the database. Kept out of *.functions.ts files so the client
// bundle (which keeps those files' top-level code) never pulls in better-sqlite3.
import { db } from '#/db/index.ts'
import { echoes, glitches } from '#/db/schema.ts'

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Next id like "GL-0143": highest existing number + 1, zero-padded. */
export function nextId(tx: Tx, prefix: 'GL' | 'EC') {
  const column = prefix === 'GL' ? glitches.glitchId : echoes.echoId
  const table = prefix === 'GL' ? glitches : echoes
  const ids = tx.select({ id: column }).from(table).all()
  const max = Math.max(0, ...ids.map(({ id }) => Number(id.split('-')[1]) || 0))
  return `${prefix}-${String(max + 1).padStart(4, '0')}`
}
