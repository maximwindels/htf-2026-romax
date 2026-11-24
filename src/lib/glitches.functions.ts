import { createServerFn } from '@tanstack/react-start'
import { asc, count, desc, eq } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { echoes, glitches, guardians } from '#/db/schema.ts'
import { requireGuardian } from '#/lib/auth.server.ts'
import { nextId } from '#/lib/ids.server.ts'
import {
  GLITCH_STATUSES,
  MAX_DESCRIPTION_LENGTH,
  type GlitchDetail,
  type GlitchListItem,
  type GlitchStatus,
} from '#/lib/glitch.ts'

// Runs in the validator, so it ships to the client too: keep it free of server imports.
function cleanDescription(value: unknown) {
  const description = String(value ?? '').trim()
  if (!description) throw new Error('Describe what you noticed')
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Keep it under ${MAX_DESCRIPTION_LENGTH} characters`)
  }
  return description
}

export const getGlitches = createServerFn({ method: 'GET' }).handler(
  async (): Promise<GlitchListItem[]> => {
    requireGuardian()
    return db
      .select({
        glitchId: glitches.glitchId,
        status: glitches.status,
        description: glitches.description,
        timestamp: glitches.timestamp,
        echoCount: count(echoes.echoId),
      })
      .from(glitches)
      .leftJoin(echoes, eq(echoes.glitchId, glitches.glitchId))
      .groupBy(glitches.glitchId)
      .orderBy(desc(glitches.timestamp))
      .all()
  },
)

export const getGlitch = createServerFn({ method: 'GET' })
  .validator((glitchId: string) => String(glitchId))
  .handler(async ({ data: glitchId }): Promise<GlitchDetail | null> => {
    requireGuardian()
    const glitch = db.select().from(glitches).where(eq(glitches.glitchId, glitchId)).get()
    if (!glitch) return null

    const rows = db
      .select({
        echoId: echoes.echoId,
        glitchId: echoes.glitchId,
        description: echoes.description,
        timestamp: echoes.timestamp,
        reportingGuardianId: echoes.reportingGuardianId,
        reporter: guardians.codename,
      })
      .from(echoes)
      .innerJoin(guardians, eq(echoes.reportingGuardianId, guardians.guardianId))
      .where(eq(echoes.glitchId, glitchId))
      .orderBy(asc(echoes.timestamp))
      .all()

    return { ...glitch, echoes: rows }
  })

/**
 * Any guardian can report an echo. Without a glitchId, the echo is a new sighting and
 * opens a new glitch (status LEAKED); with one, it's an update on that glitch.
 */
export const reportEcho = createServerFn({ method: 'POST' })
  .validator((data: { description: string; glitchId?: string }) => ({
    description: cleanDescription(data?.description),
    glitchId: data?.glitchId ? String(data.glitchId) : undefined,
  }))
  .handler(async ({ data }): Promise<{ glitchId: string; echoId: string }> => {
    const guardian = requireGuardian()
    const timestamp = new Date().toISOString()

    return db.transaction((tx) => {
      let glitchId = data.glitchId
      if (glitchId) {
        const exists = tx.select().from(glitches).where(eq(glitches.glitchId, glitchId)).get()
        if (!exists) throw new Error(`Glitch ${glitchId} no longer exists`)
      } else {
        glitchId = nextId(tx, 'GL')
        tx.insert(glitches)
          .values({ glitchId, status: 'LEAKED', description: data.description, timestamp })
          .run()
      }

      const echoId = nextId(tx, 'EC')
      tx.insert(echoes)
        .values({
          echoId,
          glitchId,
          description: data.description,
          timestamp,
          reportingGuardianId: guardian.guardianId,
        })
        .run()
      return { glitchId, echoId }
    })
  })

/** Commander only. */
export const setGlitchStatus = createServerFn({ method: 'POST' })
  .validator((data: { glitchId: string; status: GlitchStatus }) => {
    if (!GLITCH_STATUSES.includes(data?.status)) throw new Error('Unknown status')
    return { glitchId: String(data.glitchId), status: data.status }
  })
  .handler(async ({ data }) => {
    requireGuardian('commander')
    db.update(glitches)
      .set({ status: data.status })
      .where(eq(glitches.glitchId, data.glitchId))
      .run()
  })

/** Commander only. Removes the glitch and all its echoes. */
export const deleteGlitch = createServerFn({ method: 'POST' })
  .validator((glitchId: string) => String(glitchId))
  .handler(async ({ data: glitchId }) => {
    requireGuardian('commander')
    db.transaction((tx) => {
      tx.delete(echoes).where(eq(echoes.glitchId, glitchId)).run()
      tx.delete(glitches).where(eq(glitches.glitchId, glitchId)).run()
    })
  })
