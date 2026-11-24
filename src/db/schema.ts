import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
// Relative imports: drizzle-kit loads this file and doesn't resolve the `#/` alias.
import { GLITCH_STATUSES } from '../lib/glitch.ts'
import { GUARDIAN_ROLES } from '../lib/guardian.ts'
import { METRICS, SEVERITIES } from '../lib/grid.ts'

export const glitches = sqliteTable('glitches', {
  glitchId: text('glitch_id').primaryKey(),
  status: text('status', { enum: GLITCH_STATUSES }).notNull(),
  description: text('description').notNull(),
  /** ISO 8601, so lexical order is chronological order. */
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
