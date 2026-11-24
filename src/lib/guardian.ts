/** What a guardian may do. A commander can do everything a defender can, plus admin. */
export const GUARDIAN_ROLES = ['defender', 'commander'] as const

export type GuardianRole = (typeof GUARDIAN_ROLES)[number]

/** A guardian as the client sees it: never includes the password hash. */
export type Guardian = {
  guardianId: string
  codename: string
  role: GuardianRole
}

export function isCommander(guardian: Pick<Guardian, 'role'> | null | undefined) {
  return guardian?.role === 'commander'
}
