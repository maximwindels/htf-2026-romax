import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GlitchMiniList } from "#/components/GlitchMiniList.tsx";
import { ReportEchoDialog } from "#/components/ReportEchoDialog.tsx";
import {
  BlockTitle,
  OverviewPage as Dashboard,
} from "#/dashboard/Overview.tsx";
import { getGlitches } from "#/lib/glitches.functions.ts";

/** How many open glitches the dashboard shows; the Glitches tab has the full list. */
const DASHBOARD_GLITCHES = 6;

type OverviewSearch = {
  /** Open the "report echo" dialog (the N shortcut links here). */
  report?: boolean;
};

export const Route = createFileRoute("/_app/")({
  validateSearch: (search: Record<string, unknown>): OverviewSearch => ({
    report:
      search.report === true || search.report === "true" ? true : undefined,
  }),
  loader: () => getGlitches(),
  component: OverviewPage,
});

/** Dashboard: a bit of everything on (almost) one screen. Every block links to its full tab. */
function OverviewPage() {
  // Auto-opened glitches reload this loader through the live stream (see dashboard/live.ts).
  const glitches = Route.useLoaderData();
  const { guardian } = Route.useRouteContext();
  // The dialog state lives in the URL, so the N shortcut can open it from any page.
  const { report } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const setReporting = (open: boolean) =>
    navigate({ search: open ? { report: true } : {}, replace: !open });
  const open = glitches.filter((g) => g.status !== "FIXED");

  return (
    <>
      <Dashboard
        glitchSummary={
          <section className="flex flex-col gap-3">
            <div className="grid-ui">
              <BlockTitle
              icon="rift"
              title={`Open glitches (${open.length})`}
              to="/glitches"
              linkLabel="All glitches"
            />
            </div>
            <GlitchMiniList glitches={open.slice(0, DASHBOARD_GLITCHES)} currentGuardianId={guardian.guardianId} />
          </section>
        }
      />
      <ReportEchoDialog open={!!report} onClose={() => setReporting(false)} />
    </>
  );
}
