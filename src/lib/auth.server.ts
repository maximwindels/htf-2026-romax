// Server-only: only import from server function handlers.
import { randomBytes } from 'node:crypto'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { guardians, sessions } from '#/db/schema.ts'
import type { Guardian, GuardianRole } from '#/lib/guardian.ts'

const SESSION_COOKIE = 'htf_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

export function createSession(guardianId: string) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = Date.now() + SESSION_TTL_MS
  db.insert(sessions).values({ token, guardianId, expiresAt }).run()
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
}

export function destroySession() {
  const token = getCookie(SESSION_COOKIE)
  if (token) db.delete(sessions).where(eq(sessions.token, token)).run()
  deleteCookie(SESSION_COOKIE, { path: '/' })
}

/** The guardian behind the request's session cookie, or null. */
export function getSessionGuardian(): Guardian | null {
  const token = getCookie(SESSION_COOKIE)
  if (!token) return null

  const row = db
    .select({
      guardianId: guardians.guardianId,
      codename: guardians.codename,
      role: guardians.role,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(guardians, eq(sessions.guardianId, guardians.guardianId))
    .where(eq(sessions.token, token))
    .get()

  if (!row) return null
  if (row.expiresAt < Date.now()) {
    db.delete(sessions).where(eq(sessions.token, token)).run()
    return null
  }
  const { expiresAt: _, ...guardian } = row
  return guardian
}

/**
 * Throws unless someone is logged in (and, if `role` is given, has that role).
 * Commanders pass every role check, since they have all defender rights too.
 */
export function requireGuardian(role?: GuardianRole): Guardian {
  const guardian = getSessionGuardian()
  if (!guardian) throw new Error('Not logged in')
  if (role === 'commander' && guardian.role !== 'commander') {
    throw new Error('Commander rights required')
  }
  return guardian
}
