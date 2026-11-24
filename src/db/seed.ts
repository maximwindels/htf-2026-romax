import { db } from './index.ts'
import { echoes, glitchEvents, glitches, guardians, sessions } from './schema.ts'
import { hashPassword } from '../lib/password.ts'

const glitchRows: (typeof glitches.$inferInsert)[] = [
  { glitchId: 'GL-0142', status: 'LEAKED', description: 'Time loop detected near the eastern clock tower', timestamp: '2026-11-10T13:42:00Z' },
  { glitchId: 'GL-0141', status: 'ASSESSING', description: 'Magic reserves dropping faster than expected', timestamp: '2026-11-10T11:05:00Z', assignedGuardianId: 'GD-003' },
  { glitchId: 'GL-0139', status: 'CONTAINING', description: 'Portal flicker in the archive vaults', timestamp: '2026-11-09T22:17:00Z', assignedGuardianId: 'GD-002' },
  { glitchId: 'GL-0137', status: 'FIXED', description: 'Echo sensors reporting duplicate signals', timestamp: '2026-11-08T08:30:00Z' },
]

// Demo accounts for local development. All share the password below.
const DEMO_PASSWORD = 'achrona'
const guardianRows: (typeof guardians.$inferInsert)[] = [
  { guardianId: 'GD-001', codename: 'Nova', role: 'commander', passwordHash: hashPassword(DEMO_PASSWORD) },
  { guardianId: 'GD-002', codename: 'Ember', role: 'defender', passwordHash: hashPassword(DEMO_PASSWORD) },
  { guardianId: 'GD-003', codename: 'Rook', role: 'defender', passwordHash: hashPassword(DEMO_PASSWORD) },
]

// Each glitch starts with the echo that reported it, its description copied from that echo.
const echoRows: (typeof echoes.$inferInsert)[] = [
  { echoId: 'EC-0201', glitchId: 'GL-0137', description: 'Echo sensors reporting duplicate signals', timestamp: '2026-11-08T08:30:00Z', reportingGuardianId: 'GD-003' },
  { echoId: 'EC-0202', glitchId: 'GL-0137', description: 'Recalibrated the sensor array, duplicates are gone', timestamp: '2026-11-08T10:12:00Z', reportingGuardianId: 'GD-003' },
  { echoId: 'EC-0203', glitchId: 'GL-0139', description: 'Portal flicker in the archive vaults', timestamp: '2026-11-09T22:17:00Z', reportingGuardianId: 'GD-002' },
  { echoId: 'EC-0204', glitchId: 'GL-0139', description: 'Flicker spreading to the second floor, sealing the doors', timestamp: '2026-11-09T23:01:00Z', reportingGuardianId: 'GD-002' },
  { echoId: 'EC-0205', glitchId: 'GL-0141', description: 'Magic reserves dropping faster than expected', timestamp: '2026-11-10T11:05:00Z', reportingGuardianId: 'GD-001' },
  { echoId: 'EC-0206', glitchId: 'GL-0142', description: 'Time loop detected near the eastern clock tower', timestamp: '2026-11-10T13:42:00Z', reportingGuardianId: 'GD-002' },
]

// History that matches the statuses and assignments above: who moved what, and when.
const eventRows: (typeof glitchEvents.$inferInsert)[] = [
  { glitchId: 'GL-0137', kind: 'status', fromValue: 'LEAKED', toValue: 'ASSESSING', guardianId: 'GD-001', timestamp: '2026-11-08T08:45:00Z' },
  { glitchId: 'GL-0137', kind: 'status', fromValue: 'ASSESSING', toValue: 'FIXED', guardianId: 'GD-001', timestamp: '2026-11-08T10:20:00Z' },
  { glitchId: 'GL-0139', kind: 'assignment', fromValue: null, toValue: 'Ember', guardianId: 'GD-001', timestamp: '2026-11-09T22:25:00Z' },
  { glitchId: 'GL-0139', kind: 'status', fromValue: 'LEAKED', toValue: 'ASSESSING', guardianId: 'GD-002', timestamp: '2026-11-09T22:40:00Z' },
  { glitchId: 'GL-0139', kind: 'status', fromValue: 'ASSESSING', toValue: 'CONTAINING', guardianId: 'GD-002', timestamp: '2026-11-09T23:05:00Z' },
  { glitchId: 'GL-0141', kind: 'assignment', fromValue: null, toValue: 'Rook', guardianId: 'GD-001', timestamp: '2026-11-10T11:20:00Z' },
  { glitchId: 'GL-0141', kind: 'status', fromValue: 'LEAKED', toValue: 'ASSESSING', guardianId: 'GD-003', timestamp: '2026-11-10T11:30:00Z' },
]

// Wipe and refill so the seed can be re-run safely. Children first, for foreign keys.
db.transaction((tx) => {
  tx.delete(sessions).run()
  tx.delete(glitchEvents).run()
  tx.delete(echoes).run()
  tx.delete(guardians).run()
  tx.delete(glitches).run()
  tx.insert(glitches).values(glitchRows).run()
  tx.insert(guardians).values(guardianRows).run()
  tx.insert(echoes).values(echoRows).run()
  tx.insert(glitchEvents).values(eventRows).run()
})

console.log(
  `Seeded ${glitchRows.length} glitches, ${guardianRows.length} guardians and ${echoRows.length} echoes and ${eventRows.length} history events.`,
)
