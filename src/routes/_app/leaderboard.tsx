import { createFileRoute } from '@tanstack/react-router'
import { Trophy, Zap } from 'lucide-react'
import { AetherBadge } from '#/components/AetherBadge.tsx'
import { PixelAvatar } from '#/components/grid/PixelAvatar.tsx'
import { PixelIcon } from '#/components/grid/PixelIcon.tsx'
import { RoleBadge } from '#/components/RoleBadge.tsx'
import { useLeaderboard } from '#/dashboard/games.ts'
import { formatTimestamp } from '#/lib/format.ts'
import { POINTS, type LeaderboardRow } from '#/lib/games.ts'
import type { GuardianRole } from '#/lib/guardian.ts'

/** Who stabilizes best: points from mini-game results, live (refreshes on every finished attempt). */
export const Route = createFileRoute('/_app/leaderboard')({
  head: () => ({ meta: [{ title: 'Leaderboard · Control Center' }] }),
  component: LeaderboardPage,
})

const seconds = (ms: number | null) => (ms === null ? '-' : `${(ms / 1000).toFixed(1)} s`)

function LeaderboardPage() {
  const { data, isLoading } = useLeaderboard()
  const { guardian } = Route.useRouteContext()
  const rows = data?.rows ?? []
  const podium = rows.slice(0, 3)

  return (
    <div className="grid-ui page leaderboard">
      <div className="page-head">
        <div>
          <span className="ribbon">Hall of the Guardians</span>
          <h1>
            <PixelIcon name="trophy" size={36} />
            Leaderboard
          </h1>
        </div>
        <p className="muted small leaderboard-rules">
          Win <b>+{POINTS.win}</b> · flawless <b>+{POINTS.flawless}</b> and an Aether Charge · time's up{' '}
          <b>{POINTS.fail}</b>. Flawless: Chrono-Pulse without a miss, Runes without a wrong rune, or tuning within 10 s.
        </p>
      </div>

      {isLoading && <div className="muted empty">Loading the hall…</div>}

      {podium.length > 0 && (
        <section className="podium">
          {/* classic podium order: second, first, third */}
          {[1, 0, 2].map((i) =>
            podium[i] ? (
              <PodiumCard key={podium[i].guardianId} row={podium[i]} place={i + 1} isMe={podium[i].guardianId === guardian.guardianId} />
            ) : (
              <div key={i} className="podium-slot" />
            ),
          )}
        </section>
      )}

      <h2 className="section-title">
        <PixelIcon name="shield" size={27} />
        All guardians
      </h2>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Guardian</th>
              <th>Role</th>
              <th>Points</th>
              <th>Wins</th>
              <th>Flawless</th>
              <th>Fails</th>
              <th>Best time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.guardianId} className={row.guardianId === guardian.guardianId ? 'is-me' : ''}>
                <td className="mono">{i + 1}</td>
                <td>
                  <span className="inline-flex items-center gap-2">
                    <PixelAvatar codename={row.codename} role={row.role} size={24} />
                    <b>{row.codename}</b>
                    <AetherBadge charges={row.charges} />
                    {row.guardianId === guardian.guardianId && <span className="muted small">you</span>}
                  </span>
                </td>
                <td>
                  <RoleBadge role={row.role as GuardianRole} />
                </td>
                <td>
                  <span className="points-cell">
                    <span className="mono big">{row.points}</span>
                    <span className="points-bar" aria-hidden="true">
                      <span style={{ width: `${Math.max(0, (row.points / Math.max(1, rows[0]?.points ?? 1)) * 100)}%` }} />
                    </span>
                  </span>
                </td>
                <td className="mono">{row.wins}</td>
                <td className="mono">{row.flawless}</td>
                <td className="mono">{row.fails}</td>
                <td className="mono">{seconds(row.bestMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">
        <PixelIcon name="vitals" size={27} />
        Latest runs
      </h2>
      <div className="card">
        {data && data.recent.length === 0 && (
          <div className="muted empty">No runs yet. Stabilize a glitch or a critical alert to get on the board.</div>
        )}
        <ul className="runs">
          {data?.recent.map((run) => (
            <li key={run.runId} className={`run run-${run.result} ${run.flawless ? 'is-flawless' : ''}`}>
              <PixelIcon name={run.result === 'fail' ? 'skull' : run.flawless ? 'crystal' : run.game === 'pulse' ? 'latency' : run.game === 'runes' ? 'rift' : 'vitals'} size={18} />
              <b>{run.codename}</b>
              <span className="muted">
                {run.result === 'fail' ? 'ran out of time on' : run.flawless ? 'flawlessly stabilized' : 'stabilized'}{' '}
                {run.target}
              </span>
              {run.result === 'win' && <span className="mono">{seconds(run.durationMs)}</span>}
              {run.flawless && (
                <span className="run-tag">
                  <Zap className="size-3" /> flawless
                </span>
              )}
              <span className="muted small run-time" suppressHydrationWarning>
                {formatTimestamp(run.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function PodiumCard({ row, place, isMe }: { row: LeaderboardRow; place: number; isMe: boolean }) {
  return (
    <div className={`podium-spot place-${place} ${isMe ? 'is-me' : ''}`}>
      <div className="podium-hero">
        <PixelAvatar codename={row.codename} role={row.role} size={64} />
        <div className="podium-name">
          {row.codename}
          <AetherBadge charges={row.charges} />
        </div>
        <div className="podium-points mono">{row.points}</div>
        <div className="muted small">
          {row.wins} wins · {row.flawless} flawless · best {seconds(row.bestMs)}
        </div>
      </div>
      {/* the pedestal: higher for first place, gold / silver / bronze */}
      <div className="pedestal">
        <span className="pedestal-place">
          <Trophy className="size-4" />#{place}
        </span>
      </div>
    </div>
  )
}
