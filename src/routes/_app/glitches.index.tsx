import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { GlitchesTable } from "#/components/GlitchesTable.tsx";
import { ReportEchoDialog } from "#/components/ReportEchoDialog.tsx";
import { PixelIcon } from "#/components/grid/PixelIcon.tsx";
import { getGlitches } from "#/lib/glitches.functions.ts";
import type { GlitchListItem } from "#/lib/glitch.ts";

/** Quick filters above the glitch list. "mine" = assigned to the logged-in guardian. */
const FILTERS = {
  all: { label: "All", matches: () => true },
  open: {
    label: "Not fixed",
    matches: (g: GlitchListItem) => g.status !== "FIXED",
  },
  mine: {
    label: "Assigned to me",
    matches: (g: GlitchListItem, me: string) => g.assigneeId === me,
  },
} as const;
type Filter = keyof typeof FILTERS;

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

/** Glitches tab: the guardians' full glitch list, with filters and "report echo". */
function GlitchesPage() {
  // Auto-opened glitches reload this loader through the live stream (see dashboard/live.ts).
  const glitches = Route.useLoaderData();
  const { guardian } = Route.useRouteContext();
  const { report } = Route.useSearch();
  const navigate = useNavigate({ from: "/glitches/" });
  const setReporting = (open: boolean) =>
    navigate({ search: open ? { report: true } : {}, replace: !open });
  const [filter, setFilter] = useState<Filter>("all");
  const count = (f: Filter) =>
    glitches.filter((g) => FILTERS[f].matches(g, guardian.guardianId)).length;
  const shown = glitches.filter((g) =>
    FILTERS[filter].matches(g, guardian.guardianId),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid-ui page-head">
        <div>
          <span className="ribbon">Chronicle of the rifts</span>
          <h1 className="section-title">
            <PixelIcon name="rift" size={36} />
            Glitches
          </h1>
        </div>
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
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filter glitches"
      >
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`h-8 rounded-full border px-3 text-sm transition-colors ${
              filter === f
                ? "border-accent bg-accent/15 text-fg"
                : "border-line text-muted hover:text-fg"
            }`}
          >
            {FILTERS[f].label} <span className="text-muted">({count(f)})</span>
          </button>
        ))}
      </div>
      <GlitchesTable
        glitches={shown}
        currentGuardianId={guardian.guardianId}
        emptyMessage={
          filter === "mine" ? "Nothing assigned to you right now." : undefined
        }
      />
      <ReportEchoDialog open={!!report} onClose={() => setReporting(false)} />
    </div>
  );
}
