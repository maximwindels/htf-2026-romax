import { EventEmitter } from 'node:events'
import type { Glitch } from '#/lib/glitch.ts'
import type { Anomaly, EarlyWarning, Tick } from '#/lib/grid.ts'

interface BusEvents {
  tick: [Tick]
  anomaly: [Anomaly]
  ack: [Anomaly]
  warning: [EarlyWarning]
  'warning-confirmed': [EarlyWarning]
  /** A glitch the system opened by itself from critical anomalies. */
  glitch: [Glitch]
}

/**
 * In-process pub/sub: the ingest loop publishes, every SSE connection subscribes.
 * Kept on globalThis so a hot reload in dev reuses the same bus instead of making a second one.
 */
const g = globalThis as typeof globalThis & { __gridBus?: EventEmitter<BusEvents> }
export const bus = (g.__gridBus ??= new EventEmitter<BusEvents>())
bus.setMaxListeners(200)
