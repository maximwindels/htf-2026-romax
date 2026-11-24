import { createFileRoute, redirect } from "@tanstack/react-router";
import { RoleBadge } from "#/components/RoleBadge.tsx";
import { AetherBadge } from "#/components/AetherBadge.tsx";
import { PixelAvatar } from "#/components/grid/PixelAvatar.tsx";
import { PixelIcon, type PixelIconName } from "#/components/grid/PixelIcon.tsx";
import { isCommander } from "#/lib/guardian.ts";
import { getGuardianRoster, type RosterEntry } from "#/lib/roster.functions.ts";

/** Admin page: only commanders may see the guardian roster. */
export const Route = createFileRoute("/_app/guardians")({
  beforeLoad: ({ context }) => {
    if (!isCommander(context.guardian)) throw redirect({ to: "/" });
  },
  loader: () => getGuardianRoster(),
  head: () => ({ meta: [{ title: "Guardians · Control Center" }] }),
  component: GuardiansPage,
});

/** One card per guardian: avatar, role, and what they are carrying right now. */
function GuardiansPage() {
  const roster = Route.useLoaderData();
  const commanders = roster.filter((g) => g.role === "commander").length;

  return (
    <div className="grid-ui page">
      <div className="page-head">
        <div>
          <span className="ribbon">The order of the grid</span>
          <h1>
            <PixelIcon name="shield" size={36} />
            Guardians
          </h1>
        </div>
        <p className="muted small">
          {roster.length} guardians · {commanders} commander
          {commanders === 1 ? "" : "s"} · {roster.length - commanders} defender
          {roster.length - commanders === 1 ? "" : "s"}
        </p>
      </div>

      <section className="roster">
        {roster.map((g) => (
          <GuardianCard key={g.guardianId} guardian={g} />
        ))}
      </section>
    </div>
  );
}

function GuardianCard({ guardian: g }: { guardian: RosterEntry }) {
  const stats: {
    icon: PixelIconName;
    label: string;
    value: number;
    warn?: boolean;
  }[] = [
    {
      icon: "rift",
      label: "Open assignments",
      value: g.openAssigned,
      warn: g.openAssigned >= 3,
    },
    { icon: "eye", label: "Echoes sent", value: g.echoesSent },
    { icon: "vitals", label: "Status moves", value: g.statusMoves },
    { icon: "crystal", label: "Stabilized", value: g.stabilized },
  ];
  return (
    <article className={`card guardian-card role-${g.role}`}>
      <div className="guardian-banner">
        <PixelAvatar codename={g.codename} role={g.role} size={72} />
      </div>
      <div className="guardian-head">
        <span className="guardian-name">{g.codename}</span>
        <AetherBadge guardianId={g.guardianId} />
      </div>
      <div className="guardian-meta">
        <RoleBadge role={g.role} />
        <span className="mono muted small">{g.guardianId}</span>
      </div>
      <dl className="guardian-stats">
        {stats.map((s) => (
          <div key={s.label} className={s.warn ? "is-warn" : ""}>
            <dt>
              <PixelIcon name={s.icon} size={18} />
              {s.label}
            </dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
