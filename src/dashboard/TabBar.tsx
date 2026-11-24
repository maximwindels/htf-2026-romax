import { Link } from "@tanstack/react-router";
import { PixelIcon } from "#/components/grid/PixelIcon";
import { isCommander } from "#/lib/guardian.ts";
import { visibleTabs } from "./tabs";
import { useGuardian } from "./useGuardian";

/**
 * Pixel tabs under the top bar. The dashboard only lights up on "/" itself; the other tabs also
 * stay lit on their detail pages (a glitch page lights "Glitches", a node page lights "Nodes").
 */
export function TabBar() {
  const { guardian } = useGuardian();
  const tabs = visibleTabs(isCommander(guardian));

  return (
    <nav className="tab-bar grid-ui" aria-label="Sections">
      {tabs.map((tab, i) => (
        <Link
          key={tab.to}
          to={tab.to}
          className="tab"
          activeOptions={{ exact: tab.to === "/" }}
          activeProps={{ className: "tab is-active", "aria-current": "page" }}
          title={`${tab.label} (${i + 1})`}
        >
          <PixelIcon name={tab.icon} size={18} />
          <span>{tab.label}</span>
          <kbd className="tab-key">{i + 1}</kbd>
        </Link>
      ))}
    </nav>
  );
}
