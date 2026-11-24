import { useRouter } from "@tanstack/react-router";
import { ChevronRight, MessageSquare } from "lucide-react";
import { PixelAvatar } from "#/components/grid/PixelAvatar.tsx";
import { PixelIcon } from "#/components/grid/PixelIcon.tsx";
import { GlitchTypeBadge } from "#/components/GlitchTypeBadge.tsx";
import { STATUS_LABELS, type GlitchListItem } from "#/lib/glitch.ts";
import { formatTimestamp } from "#/lib/format.ts";

const columns = [
  "ID",
  "Status",
  "Description",
  "Assignee",
  "Echoes",
  "Reported",
  "",
];

type GlitchesTableProps = {
  glitches: GlitchListItem[];
  /** The logged-in guardian: their own assignments are marked "you". */
  currentGuardianId?: string;
  /** Shown when the list is empty. */
  emptyMessage?: string;
};

/** The glitch list in the app's theme (pixel status chips, guardian avatars). Rows open the glitch. */
export function GlitchesTable({
  glitches,
  currentGuardianId,
  emptyMessage = "No glitches. Achrona is calm, for now.",
}: GlitchesTableProps) {
  const router = useRouter();

  if (glitches.length === 0) {
    return (
      <div className="card empty-state">
        <PixelIcon name="crystal" size={45} />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="card table-wrap glitch-table">
      <table>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {glitches.map((glitch) => {
            const open = () =>
              router.navigate({
                to: "/glitches/$glitchId",
                params: { glitchId: glitch.glitchId },
              });
            const isMine = glitch.assigneeId === currentGuardianId;
            return (
              <tr
                key={glitch.glitchId}
                data-glitch-row
                tabIndex={0}
                onClick={open}
                onKeyDown={(e) => e.key === "Enter" && open()}
                className={`glitch-row status-${glitch.status.toLowerCase()} ${isMine ? "is-mine" : ""}`}
              >
                <td className="mono glitch-id">{glitch.glitchId}</td>
                <td>
                  <span
                    className={`status-chip status-${glitch.status.toLowerCase()}`}
                  >
                    <span
                      className={`glitch-dot status-${glitch.status.toLowerCase()}`}
                    />
                    {STATUS_LABELS[glitch.status]}
                  </span>
                </td>
                <td className="glitch-desc">
                  <GlitchTypeBadge type={glitch.glitchType} compact />
                  {glitch.description}
                </td>
                <td>
                  {glitch.assignee ? (
                    <span className="who">
                      <PixelAvatar codename={glitch.assignee} size={22} />
                      {glitch.assignee}
                      {isMine && <span className="you-tag">you</span>}
                    </span>
                  ) : (
                    <span className="muted">unassigned</span>
                  )}
                </td>
                <td className="muted">
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquare className="size-4" strokeWidth={1.75} />
                    {glitch.echoCount}
                  </span>
                </td>
                <td className="muted small">
                  {/* Server and browser time zones can differ; the browser's wins. */}
                  <time dateTime={glitch.timestamp} suppressHydrationWarning>
                    {formatTimestamp(glitch.timestamp)}
                  </time>
                </td>
                <td className="muted">
                  <ChevronRight className="size-5" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
