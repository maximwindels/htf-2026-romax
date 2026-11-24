import { createServerFn } from '@tanstack/react-start'
import { asc, count, desc, eq } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { aiNotes, echoes, glitchEvents, glitches, guardians } from '#/db/schema.ts'
import { requireGuardian } from '#/lib/auth.server.ts'
import { parseRunMeta, type GameRunMeta } from '#/lib/games.ts'
import { recordRun } from '#/lib/games.server.ts'
import { announce, assignee, logEvent } from '#/lib/glitches.server.ts'
import { nextId } from '#/lib/ids.server.ts'
import { addAiNote, codenameOf, triageEcho } from '#/server/ai/triage.ts'
import { describeProof, parseProof, verifyProof, type StabilizeProof } from '#/lib/stabilize.ts'
import {
  GLITCH_STATUSES,
  MAX_DESCRIPTION_LENGTH,
  nextStatus,
  type GlitchDetail,
  type GlitchListItem,
  type GlitchStatus,
} from '#/lib/glitch.ts'
import type { Guardian } from '#/lib/guardian.ts'

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
        glitchType: glitches.glitchType,
        assigneeId: glitches.assignedGuardianId,
        assignee: assignee.codename,
      })
      .from(glitches)
      .leftJoin(echoes, eq(echoes.glitchId, glitches.glitchId))
      .leftJoin(assignee, eq(assignee.guardianId, glitches.assignedGuardianId))
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

    const events = db
      .select({
        eventId: glitchEvents.eventId,
        glitchId: glitchEvents.glitchId,
        kind: glitchEvents.kind,
        fromValue: glitchEvents.fromValue,
        toValue: glitchEvents.toValue,
        actor: guardians.codename,
        timestamp: glitchEvents.timestamp,
      })
      .from(glitchEvents)
      .innerJoin(guardians, eq(glitchEvents.guardianId, guardians.guardianId))
      .where(eq(glitchEvents.glitchId, glitchId))
      .orderBy(asc(glitchEvents.timestamp), asc(glitchEvents.eventId))
      .all()

    // Same order as the overview list, so J/K on the page matches J/K in the list.
    const order = db
      .select({ id: glitches.glitchId })
      .from(glitches)
      .orderBy(desc(glitches.timestamp))
      .all()
      .map((g) => g.id)
    const i = order.indexOf(glitchId)

    const notes = db
      .select()
      .from(aiNotes)
      .where(eq(aiNotes.glitchId, glitchId))
      .orderBy(asc(aiNotes.timestamp), asc(aiNotes.noteId))
      .all()

    const assigned = glitch.assignedGuardianId
      ? db.select().from(guardians).where(eq(guardians.guardianId, glitch.assignedGuardianId)).get()
      : undefined

    return {
      ...glitch,
      echoes: rows,
      events,
      aiNotes: notes,
      assigneeId: glitch.assignedGuardianId,
      assignee: assigned?.codename ?? null,
      newerId: order[i - 1] ?? null,
      olderId: order[i + 1] ?? null,
    }
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
  .handler(async ({ data }): Promise<{ glitchId: string; echoId: string; ai: string }> => {
    const guardian = requireGuardian()
    const timestamp = new Date().toISOString()

    // AI triage (or its rules): moderation, type, duplicate, "resolved?", best defender.
    const triage = await triageEcho(data.description, data.glitchId)
    if (!triage.accept) throw new Error(`Echo not accepted: ${triage.rejectReason || 'this does not look like a report'}`)
    const by = triage.source === 'ai' ? 'AI' : 'Rules'

    const notes: { action: Parameters<typeof addAiNote>[1]; message: string }[] = []
    const result = db.transaction((tx) => {
      let glitchId = data.glitchId
      if (glitchId) {
        const exists = tx.select().from(glitches).where(eq(glitches.glitchId, glitchId)).get()
        if (!exists) throw new Error(`Glitch ${glitchId} no longer exists`)
        // Auto-close: an update that says the problem is gone. A glitch in Containing is closed
        // through the stabilizer mini-game, so there the AI only suggests it.
        if (triage.resolves && exists.status !== 'FIXED') {
          if (exists.status === 'CONTAINING') {
            notes.push({ action: 'suggested', message: `${by}: this echo says it is resolved. Stabilize the signal to close it. (${triage.reason})` })
          } else {
            tx.update(glitches).set({ status: 'FIXED' }).where(eq(glitches.glitchId, glitchId)).run()
            notes.push({ action: 'closed', message: `${by} closed the glitch: ${triage.reason}` })
          }
        }
      } else if (triage.duplicateOf) {
        // Duplicate: the echo joins the glitch it is about; a fixed one is reopened.
        glitchId = triage.duplicateOf
        const existing = tx.select().from(glitches).where(eq(glitches.glitchId, glitchId)).get()
        notes.push({ action: 'grouped', message: `${by} grouped a new echo from ${guardian.codename} under this glitch: ${triage.reason}` })
        if (existing?.status === 'FIXED') {
          tx.update(glitches).set({ status: 'LEAKED' }).where(eq(glitches.glitchId, glitchId)).run()
          notes.push({ action: 'reopened', message: `${by} reopened the glitch: the same problem was reported again` })
        }
      } else {
        glitchId = nextId(tx, 'GL')
        tx.insert(glitches)
          .values({
            glitchId,
            status: 'LEAKED',
            description: data.description,
            timestamp,
            glitchType: triage.glitchType,
            assignedGuardianId: triage.assignTo,
          })
          .run()
        notes.push({ action: 'typed', message: `${by} sorted this as a ${triage.glitchType} glitch` })
        if (triage.assignTo) {
          notes.push({ action: 'assigned', message: `${by} assigned it to ${codenameOf(triage.assignTo)}: ${triage.reason}` })
        }
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
    for (const n of notes) addAiNote(result.glitchId, n.action, n.message, triage.source)
    announce(result.glitchId)
    return { ...result, ai: notes.map((n) => n.message).join(' · ') }
  })

/**
 * Any guardian can close a CONTAINING glitch, but only by tuning into its signal
 * (the mini-game). The server re-checks the values, so the API can't be used to skip it.
 */
export const stabilizeGlitch = createServerFn({ method: 'POST' })
  .validator((data: { glitchId: string; proof: StabilizeProof; run?: GameRunMeta }) => ({
    glitchId: String(data?.glitchId),
    proof: parseProof(data?.proof),
    run: parseRunMeta(data?.run),
  }))
  .handler(async ({ data }) => {
    const guardian = requireGuardian()
    const proof = data.proof
    if (!proof || !verifyProof(data.glitchId, proof)) {
      throw new Error('Not stable yet, keep going')
    }

    db.transaction((tx) => {
      const glitch = tx.select().from(glitches).where(eq(glitches.glitchId, data.glitchId)).get()
      if (!glitch) throw new Error(`Glitch ${data.glitchId} no longer exists`)
      if (glitch.status !== 'CONTAINING') {
        throw new Error('Only glitches that are being contained can be stabilized')
      }
      tx.update(glitches).set({ status: 'FIXED' }).where(eq(glitches.glitchId, data.glitchId)).run()
      logEvent(tx, guardian, data.glitchId, 'status', 'CONTAINING', 'FIXED')
      tx.insert(echoes)
        .values({
          echoId: nextId(tx, 'EC'),
          glitchId: data.glitchId,
          description: describeProof(proof),
          timestamp: new Date().toISOString(),
          reportingGuardianId: guardian.guardianId,
        })
        .run()
    })
    // A won mini-game: leaderboard, and a flawless one makes the grid more immune.
    recordRun(guardian, { game: proof.kind, result: 'win', target: data.glitchId, ...data.run })
    announce(data.glitchId)
  })

/**
 * Move a glitch through its lifecycle (LEAKED > ASSESSING > CONTAINING > FIXED).
 * - A commander may set any status (also back, to reopen a glitch).
 * - The defender it is assigned to may only move it one step forward, and fixes it
 *   (CONTAINING > FIXED) only through the stabilizer mini-game (stabilizeGlitch).
 * Every change is written to the glitch's history.
 */
export const setGlitchStatus = createServerFn({ method: 'POST' })
  .validator((data: { glitchId: string; status: GlitchStatus }) => {
    if (!GLITCH_STATUSES.includes(data?.status)) throw new Error('Unknown status')
    return { glitchId: String(data.glitchId), status: data.status }
  })
  .handler(async ({ data }) => {
    const guardian = requireGuardian()
    const glitch = db.select().from(glitches).where(eq(glitches.glitchId, data.glitchId)).get()
    if (!glitch) throw new Error(`Glitch ${data.glitchId} no longer exists`)
    if (glitch.status === data.status) return

    if (guardian.role !== 'commander') {
      if (glitch.assignedGuardianId !== guardian.guardianId) {
        throw new Error('Only the assigned defender or a commander can change the status')
      }
      if (nextStatus(glitch.status) !== data.status) {
        throw new Error('Defenders can only move a glitch one step forward')
      }
      if (data.status === 'FIXED') {
        throw new Error('Stabilize the signal to fix this glitch')
      }
    }

    db.transaction((tx) => {
      tx.update(glitches).set({ status: data.status }).where(eq(glitches.glitchId, data.glitchId)).run()
      logEvent(tx, guardian, data.glitchId, 'status', glitch.status, data.status)
    })
    announce(data.glitchId)
  })

/** Commander only: assign a glitch to a defender, or unassign it with `guardianId: null`. */
export const assignGlitch = createServerFn({ method: 'POST' })
  .validator((data: { glitchId: string; guardianId: string | null }) => ({
    glitchId: String(data?.glitchId),
    guardianId: data?.guardianId ? String(data.guardianId) : null,
  }))
  .handler(async ({ data }) => {
    const commander = requireGuardian('commander')
    const glitch = db.select().from(glitches).where(eq(glitches.glitchId, data.glitchId)).get()
    if (!glitch) throw new Error(`Glitch ${data.glitchId} no longer exists`)
    if (glitch.assignedGuardianId === data.guardianId) return

    const findGuardian = (guardianId: string | null) =>
      guardianId ? db.select().from(guardians).where(eq(guardians.guardianId, guardianId)).get() : undefined

    const target = findGuardian(data.guardianId)
    if (data.guardianId && !target) throw new Error('Unknown guardian')
    if (target && target.role !== 'defender') throw new Error('Glitches can only be assigned to defenders')
    const previous = findGuardian(glitch.assignedGuardianId)

    db.transaction((tx) => {
      tx.update(glitches)
        .set({ assignedGuardianId: data.guardianId })
        .where(eq(glitches.glitchId, data.glitchId))
        .run()
      logEvent(tx, commander, data.glitchId, 'assignment', previous?.codename ?? null, target?.codename ?? null)
    })
    announce(data.glitchId)
  })

/** Commander only: the defenders a glitch can be assigned to. */
export const getDefenders = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Guardian[]> => {
    requireGuardian('commander')
    return db
      .select({ guardianId: guardians.guardianId, codename: guardians.codename, role: guardians.role })
      .from(guardians)
      .where(eq(guardians.role, 'defender'))
      .orderBy(asc(guardians.codename))
      .all()
  },
)

/** Commander only. Removes the glitch and all its echoes. */
export const deleteGlitch = createServerFn({ method: 'POST' })
  .validator((glitchId: string) => String(glitchId))
  .handler(async ({ data: glitchId }) => {
    requireGuardian('commander')
    db.transaction((tx) => {
      tx.delete(glitchEvents).where(eq(glitchEvents.glitchId, glitchId)).run()
      tx.delete(aiNotes).where(eq(aiNotes.glitchId, glitchId)).run()
      tx.delete(echoes).where(eq(echoes.glitchId, glitchId)).run()
      tx.delete(glitches).where(eq(glitches.glitchId, glitchId)).run()
    })
  })
