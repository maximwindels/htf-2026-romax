import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { guardians } from '#/db/schema.ts'
import {
  createSession,
  destroySession,
  getSessionGuardian,
  requireGuardian,
} from '#/lib/auth.server.ts'
import type { Guardian } from '#/lib/guardian.ts'
import { verifyPassword } from '#/lib/password.ts'

export const getCurrentGuardian = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Guardian | null> => getSessionGuardian(),
)

type LoginInput = { codename: string; password: string }

export const login = createServerFn({ method: 'POST' })
  .validator((data: LoginInput) => {
    const codename = String(data?.codename ?? '').trim()
    const password = String(data?.password ?? '')
    if (!codename || !password) throw new Error('Enter your codename and password')
    return { codename, password }
  })
  .handler(async ({ data }): Promise<Guardian> => {
    const row = db
      .select()
      .from(guardians)
      .where(eq(guardians.codename, data.codename))
      .get()

    // Same message for unknown codename and wrong password, so codenames can't be probed.
    if (!row || !verifyPassword(data.password, row.passwordHash)) {
      throw new Error('Unknown codename or wrong password')
    }

    createSession(row.guardianId)
    return { guardianId: row.guardianId, codename: row.codename, role: row.role }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  destroySession()
})

/** Commander only: every guardian, without password hashes. */
export const getGuardians = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Guardian[]> => {
    requireGuardian('commander')
    return db
      .select({
        guardianId: guardians.guardianId,
        codename: guardians.codename,
        role: guardians.role,
      })
      .from(guardians)
      .orderBy(asc(guardians.codename))
      .all()
  },
)
