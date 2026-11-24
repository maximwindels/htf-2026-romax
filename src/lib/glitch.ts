/** Lifecycle of a glitch, in order. */
export const GLITCH_STATUSES = [
  'LEAKED',
  'ASSESSING',
  'CONTAINING',
  'FIXED',
] as const

export type GlitchStatus = (typeof GLITCH_STATUSES)[number]

/** Kinds of glitches the AI sorts reports into. Each has its own pixel icon and colour in the UI. */
export const GLITCH_TYPES = ['temporal', 'mana', 'thermal', 'desync', 'portal', 'signal', 'other'] as const
export type GlitchType = (typeof GLITCH_TYPES)[number]

export const GLITCH_TYPE_INFO: Record<GlitchType, { label: string; icon: string; color: string; hint: string }> = {
  temporal: { label: 'Temporal', icon: 'latency', color: '#fbbf24', hint: 'time loops, clocks, delays' },
  mana: { label: 'Mana', icon: 'load', color: '#7fb2ff', hint: 'magic reserves, mana load' },
  thermal: { label: 'Thermal', icon: 'temperature', color: '#f0a04b', hint: 'heat, fire, overheating cores' },
  desync: { label: 'Desync', icon: 'drift', color: '#e292f4', hint: 'sync drift, The Desync itself' },
  portal: { label: 'Portal', icon: 'rift', color: '#a52bd9', hint: 'portals, rifts, flickering space' },
  signal: { label: 'Signal', icon: 'vitals', color: '#38bdf8', hint: 'sensors, relays, echoes, latency' },
  other: { label: 'Other', icon: 'eye', color: '#9d9bb8', hint: 'anything else' },
}

/** What the AI can do to a glitch (see ai_notes). */
export const AI_ACTIONS = ['typed', 'assigned', 'grouped', 'reopened', 'closed', 'suggested', 'split', 'runbook'] as const
export type AiAction = (typeof AI_ACTIONS)[number]

export type AiNote = {
  noteId: number
  glitchId: string
  action: AiAction
  message: string
  /** 'ai' = Claude, 'rules' = offline fallback */
  source: string
  /** ISO 8601 */
  timestamp: string
}

export type RunbookStep = { title: string; detail: string }

export type Glitch = {
  glitchId: string
  status: GlitchStatus
  description: string
  /** ISO 8601 */
  timestamp: string
  /** Set by the AI triage; null for glitches from before it existed. */
  glitchType?: GlitchType | null
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
  /** What the AI did to this glitch, oldest first. */
  aiNotes: AiNote[]
  /** JSON array of RunbookStep, or null */
  runbook: string | null
  runbookSource: string | null
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
