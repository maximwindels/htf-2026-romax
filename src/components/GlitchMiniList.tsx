import { Link } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { GlitchTypeBadge } from "#/components/GlitchTypeBadge.tsx";
import { STATUS_LABELS, type GlitchListItem } from "#/lib/glitch.ts";

/**
 * Compact glitch list for the dashboard: one line per glitch (status, id, description, assignee).
 * The full table with filters is on the Glitches tab. Rows work with the J/K shortcuts too.
 */
export function GlitchMiniList({
  glitches,
  currentGuardianId,
}: {
  glitches: GlitchListItem[];
  currentGuardianId: string;
}) {
  if (glitches.length === 0)
    return (
      <div className="card muted empty">
        No open glitches. Achrona is calm, for now.
      </div>
    );

  return (
    <ul className="card glitch-mini">
      {glitches.map((g) => (
        <li key={g.glitchId}>
          <Link
            to="/glitches/$glitchId"
            params={{ glitchId: g.glitchId }}
            className="glitch-mini-row"
            data-glitch-row
          >
            <span
              className={`glitch-dot status-${g.status.toLowerCase()}`}
              title={STATUS_LABELS[g.status]}
            />
            <span className="mono glitch-mini-id">{g.glitchId}</span>
            <span className="glitch-mini-desc">
              <GlitchTypeBadge type={g.glitchType} compact />
              {g.description}
            </span>
            <span
              className={`glitch-mini-who ${g.assigneeId === currentGuardianId ? "is-me" : ""}`}
            >
              <UserRound className="size-3.5" />
              {g.assignee ?? "-"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
