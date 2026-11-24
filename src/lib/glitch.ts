/** Lifecycle of a glitch, in order. */
export const GLITCH_STATUSES = [
  'LEAKED',
  'ASSESSING',
  'CONTAINING',
  'FIXED',
] as const

export type GlitchStatus = (typeof GLITCH_STATUSES)[number]

export type Glitch = {
  glitchId: string
  status: GlitchStatus
  description: string
  /** ISO 8601 */
  timestamp: string
}

/** A glitch as listed in the overview. */
export type GlitchListItem = Glitch & {
  echoCount: number
  /** Defender the glitch is assigned to, or null. */
  assigneeId: string | null
  assignee: string | null
}

export type Echo = {
  echoId: string
  glitchId: string
  description: string
  /** ISO 8601 */
  timestamp: string
  reportingGuardianId: string
  /** Codename of the reporting guardian, for display. */
  reporter: string
}

/** Something that happened to a glitch: a status change or a (re)assignment. */
export const GLITCH_EVENT_KINDS = ['status', 'assignment'] as const
export type GlitchEventKind = (typeof GLITCH_EVENT_KINDS)[number]

export type GlitchEvent = {
  eventId: number
  glitchId: string
  kind: GlitchEventKind
  /** status: old/new status. assignment: old/new defender codename (null = nobody). */
  fromValue: string | null
  toValue: string | null
  /** Codename of the guardian who made the change. */
  actor: string
  /** ISO 8601 */
  timestamp: string
}

export type GlitchDetail = Glitch & {
  echoes: Echo[]
  /** Status changes and (re)assignments, oldest first. */
  events: GlitchEvent[]
  assigneeId: string | null
  assignee: string | null
  /** Neighbours in the overview's order (newest first), for J/K navigation. */
  newerId: string | null
  olderId: string | null
}

export const STATUS_LABELS: Record<GlitchStatus, string> = {
  LEAKED: 'Leaked',
  ASSESSING: 'Assessing',
  CONTAINING: 'Containing',
  FIXED: 'Fixed',
}

/** What each step of the lifecycle means, shown under the status stepper. */
export const STATUS_DESCRIPTIONS: Record<GlitchStatus, string> = {
  LEAKED: 'Reported, nobody is on it yet',
  ASSESSING: 'A guardian is finding out what is going on',
  CONTAINING: 'Working on stopping it',
  FIXED: 'Achrona is safe again',
}

/** The next step in the lifecycle, or null when the glitch is fixed. */
export function nextStatus(status: GlitchStatus): GlitchStatus | null {
  const i = GLITCH_STATUSES.indexOf(status)
  return GLITCH_STATUSES[i + 1] ?? null
}

export const MAX_DESCRIPTION_LENGTH = 500
