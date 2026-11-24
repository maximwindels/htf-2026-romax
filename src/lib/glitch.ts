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
export type GlitchListItem = Glitch & { echoCount: number }

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

export type GlitchDetail = Glitch & {
  echoes: Echo[]
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

export const MAX_DESCRIPTION_LENGTH = 500
