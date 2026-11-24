import { useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { GlitchesTable } from "#/components/GlitchesTable.tsx";
import { ReportEchoDialog } from "#/components/ReportEchoDialog.tsx";
import { PixelIcon } from "#/components/grid/PixelIcon.tsx";
import { getGlitches } from "#/lib/glitches.functions.ts";
import {
  GLITCH_STATUSES,
  STATUS_DESCRIPTIONS,
  STATUS_LABELS,
  type GlitchStatus,
} from "#/lib/glitch.ts";

const PAGE_SIZE = 12;

type GlitchesSearch = {
  /** Open the "report echo" dialog. */
  report?: boolean;
};

export const Route = createFileRoute("/_app/glitches/")({
  validateSearch: (search: Record<string, unknown>): GlitchesSearch => ({
    report:
      search.report === true || search.report === "true" ? true : undefined,
  }),
  loader: () => getGlitches(),
  component: GlitchesPage,
});

/**
 * Glitches tab: the lifecycle at a glance (one card per status, click to filter),
 * then the full list with search, "assigned to me" and pages.
 */
function GlitchesPage() {
  // Auto-opened glitches reload this loader through the live stream (see dashboard/live.ts).
  const glitches = Route.useLoaderData();
  const { guardian } = Route.useRouteContext();
  const { report } = Route.useSearch();
  const navigate = useNavigate({ from: "/glitches/" });
  const router = useRouter();
  // Closing the dialog only resets the URL while we are still on the list: after sending an echo,
  // the dialog navigates to the glitch, and closing must not pull us back here.
  const setReporting = (open: boolean) => {
    const path = router.state.location.pathname;
    if (!open && path !== "/glitches" && path !== "/glitches/") return;
    navigate({ search: open ? { report: true } : {}, replace: !open });
  };

  const [status, setStatus] = useState<GlitchStatus | "all">("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const countOf = (s: GlitchStatus) =>
    glitches.filter((g) => g.status === s).length;
  const mineCount = glitches.filter(
    (g) => g.assigneeId === guardian.guardianId,
  ).length;
  const q = query.trim().toLowerCase();
  const shown = glitches.filter(
    (g) =>
      (status === "all" || g.status === status) &&
      (!mineOnly || g.assigneeId === guardian.guardianId) &&
      (!q ||
        `${g.glitchId} ${g.description} ${g.assignee ?? ""}`
          .toLowerCase()
          .includes(q)),
  );
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = shown.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const filterBy = (next: GlitchStatus | "all") => {
    setStatus((s) => (s === next ? "all" : next));
    setPage(0);
  };

  return (
    <div className="grid-ui page glitches-page">
      <div className="page-head">
        <div>
          <span className="ribbon">Chronicle of the rifts</span>
          <h1>
            <PixelIcon name="rift" size={36} />
            Glitches
          </h1>
        </div>
        <div className="actions">
          {/* Every guardian (defender and commander) may report an echo. */}
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="inline-flex items-center gap-2"
            title="Report echo (N)"
          >
            <Plus className="size-4" />
            Report echo
          </button>
        </div>
      </div>

      {/* the lifecycle: one card per status, click one to show only those */}
      <section className="lifecycle" aria-label="Glitches per status">
        {GLITCH_STATUSES.map((s, i) => (
          <button
            key={s}
            type="button"
            className={`lifecycle-card status-${s.toLowerCase()} ${status === s ? "is-active" : ""}`}
            aria-pressed={status === s}
            onClick={() => filterBy(s)}
          >
            <span className="lifecycle-step">Step {i + 1}</span>
            <span className="lifecycle-name">
              <span className={`glitch-dot status-${s.toLowerCase()}`} />
              {STATUS_LABELS[s]}
            </span>
            <span className="lifecycle-count">{countOf(s)}</span>
            <span className="lifecycle-desc">{STATUS_DESCRIPTIONS[s]}</span>
          </button>
        ))}
      </section>

      <div className="toolbar">
        <input
          placeholder="Search id, description, guardian…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          aria-label="Search glitches"
        />
        <label className="check">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => {
              setMineOnly(e.target.checked);
              setPage(0);
            }}
          />{" "}
          Assigned to me ({mineCount})
        </label>
        {status !== "all" && (
          <button
            type="button"
            className="btn-small ghost"
            onClick={() => filterBy("all")}
          >
            Show all statuses
          </button>
        )}
        <span className="muted small">{shown.length} glitches</span>
      </div>

      <GlitchesTable
        glitches={visible}
        currentGuardianId={guardian.guardianId}
        emptyMessage={
          mineOnly
            ? "Nothing assigned to you right now."
            : "No glitches match. Achrona is calm, for now."
        }
      />

      {pages > 1 && (
        <div className="pager">
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
          >
            ‹ Prev
          </button>
          <span className="muted small">
            Page {current + 1} / {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current >= pages - 1}
          >
            Next ›
          </button>
        </div>
      )}

      <ReportEchoDialog open={!!report} onClose={() => setReporting(false)} />
    </div>
  );
}
