import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
// Relative imports: drizzle-kit loads this file and doesn't resolve the `#/` alias.
import { AI_ACTIONS, GLITCH_EVENT_KINDS, GLITCH_STATUSES, GLITCH_TYPES } from '../lib/glitch.ts'
import { GAME_KINDS, GAME_RESULTS } from '../lib/games.ts'
import { GUARDIAN_ROLES } from '../lib/guardian.ts'
import { METRICS, SEVERITIES } from '../lib/grid.ts'

export const glitches = sqliteTable('glitches', {
  glitchId: text('glitch_id').primaryKey(),
  status: text('status', { enum: GLITCH_STATUSES }).notNull(),
  description: text('description').notNull(),
  /** ISO 8601, so lexical order is chronological order. */
  timestamp: text('timestamp').notNull(),
  /** Defender a commander assigned this glitch to; they send updates as echoes. Null = unassigned. */
  assignedGuardianId: text('assigned_guardian_id').references(() => guardians.guardianId, {
    onDelete: 'set null',
  }),
  /** What kind of glitch this is, set by the AI triage (or the keyword rules without AI). */
  glitchType: text('glitch_type', { enum: GLITCH_TYPES }),
  /** AI-generated runbook: JSON array of { title, detail } steps. */
  runbook: text('runbook'),
  /** Who wrote the runbook: 'ai' (Claude) or 'rules' (the offline template). */
  runbookSource: text('runbook_source'),
})

/**
 * What the AI did to a glitch, shown in its timeline: grouped a duplicate echo, reopened it,
 * closed it, picked its type or its defender. Separate from glitch_events, which are always
 * done by a guardian.
 */
export const aiNotes = sqliteTable('ai_notes', {
  noteId: integer('note_id').primaryKey({ autoIncrement: true }),
  glitchId: text('glitch_id')
    .notNull()
    .references(() => glitches.glitchId, { onDelete: 'cascade' }),
  action: text('action', { enum: AI_ACTIONS }).notNull(),
  message: text('message').notNull(),
  /** 'ai' when Claude decided, 'rules' when the offline fallback did */
  source: text('source').notNull(),
  /** ISO 8601 */
  timestamp: text('timestamp').notNull(),
})

export const guardians = sqliteTable('guardians', {
  guardianId: text('guardian_id').primaryKey(),
  codename: text('codename').notNull().unique(),
  role: text('role', { enum: GUARDIAN_ROLES }).notNull(),
  /** scrypt hash, see src/lib/password.ts */
  passwordHash: text('password_hash').notNull(),
})

/** A report from a guardian. Every echo belongs to exactly one glitch. */
export const echoes = sqliteTable('echoes', {
  echoId: text('echo_id').primaryKey(),
  glitchId: text('glitch_id')
    .notNull()
    .references(() => glitches.glitchId, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  /** ISO 8601 */
  timestamp: text('timestamp').notNull(),
  reportingGuardianId: text('reporting_guardian_id')
    .notNull()
    .references(() => guardians.guardianId),
})

/** History of a glitch: every status change and (re)assignment, with who did it and when. */
export const glitchEvents = sqliteTable('glitch_events', {
  eventId: integer('event_id').primaryKey({ autoIncrement: true }),
  glitchId: text('glitch_id')
    .notNull()
    .references(() => glitches.glitchId, { onDelete: 'cascade' }),
  kind: text('kind', { enum: GLITCH_EVENT_KINDS }).notNull(),
  fromValue: text('from_value'),
  toValue: text('to_value'),
  guardianId: text('guardian_id')
    .notNull()
    .references(() => guardians.guardianId),
  /** ISO 8601 */
  timestamp: text('timestamp').notNull(),
})

/** Every mini-game attempt that ended: won (stabilized) or failed (time ran out). Feeds the leaderboard. */
export const gameRuns = sqliteTable('game_runs', {
  runId: integer('run_id').primaryKey({ autoIncrement: true }),
  guardianId: text('guardian_id')
    .notNull()
    .references(() => guardians.guardianId, { onDelete: 'cascade' }),
  game: text('game', { enum: GAME_KINDS }).notNull(),
  result: text('result', { enum: GAME_RESULTS }).notNull(),
  flawless: integer('flawless', { mode: 'boolean' }).notNull(),
  durationMs: integer('duration_ms').notNull(),
  /** What was being stabilized: a glitch id, or an anomaly seed like AN-12. */
  target: text('target').notNull(),
  /** ISO 8601 */
  timestamp: text('timestamp').notNull(),
})

/** One row per logged-in browser; the token lives in an httpOnly cookie. */
export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(),
  guardianId: text('guardian_id')
    .notNull()
    .references(() => guardians.guardianId, { onDelete: 'cascade' }),
  /** Unix epoch milliseconds */
  expiresAt: integer('expires_at').notNull(),
})

// ---------- live grid telemetry (mission control dashboard) ----------

/** The places in Achrona that send sensor data. x/y = position on the network map. */
export const nodes = sqliteTable('nodes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  region: text('region').notNull(),
  x: real('x').notNull(),
  y: real('y').notNull(),
})

/** One sensor value. All readings of one tick share the same `ts`, so "group by ts" gives one chart point per tick. */
export const readings = sqliteTable(
  'readings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nodeId: text('node_id').notNull().references(() => nodes.id),
    metric: text('metric', { enum: METRICS }).notNull(),
    value: real('value').notNull(),
    /** Unix time in ms (a number, so range queries and grouping stay fast). */
    ts: integer('ts').notNull(),
  },
  (t) => [
    index('readings_metric_ts_idx').on(t.metric, t.ts),
    index('readings_node_metric_ts_idx').on(t.nodeId, t.metric, t.ts),
  ],
)

/** A reading the detector flagged (z-score or hard limit). */
export const anomalies = sqliteTable(
  'anomalies',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nodeId: text('node_id').notNull().references(() => nodes.id),
    metric: text('metric', { enum: METRICS }).notNull(),
    value: real('value').notNull(),
    expected: real('expected').notNull(),
    zscore: real('zscore').notNull(),
    severity: text('severity', { enum: SEVERITIES }).notNull(),
    message: text('message').notNull(),
    /** ISO 8601 */
    ts: text('ts').notNull(),
    /** ISO 8601, null while open */
    acknowledgedAt: text('acknowledged_at'),
  },
  (t) => [index('anomalies_ts_idx').on(t.ts)],
)

/** A forecast "this metric will cross its limit soon", confirmed when the limit is really crossed. */
export const earlyWarnings = sqliteTable(
  'early_warnings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nodeId: text('node_id').notNull().references(() => nodes.id),
    metric: text('metric', { enum: METRICS }).notNull(),
    value: real('value').notNull(),
    limitValue: real('limit_value').notNull(),
    etaSeconds: real('eta_seconds').notNull(),
    /** ISO 8601 */
    ts: text('ts').notNull(),
    /** ISO 8601, set when the predicted limit crossing really happened */
    confirmedAt: text('confirmed_at'),
    /** seconds between the warning and the crossing */
    leadSeconds: real('lead_seconds'),
  },
  (t) => [index('early_warnings_node_metric_ts_idx').on(t.nodeId, t.metric, t.ts)],
)
