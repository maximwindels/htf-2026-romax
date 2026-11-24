import { useMemo } from "react";
import {
  HARD_LIMITS,
  METRIC_INFO,
  METRICS,
  type GridNode,
  type Metric,
} from "#/lib/grid.ts";
import { fmt } from "#/dashboard/format";
import { useLatest, type NodeStatus } from "#/dashboard/hooks";
import { NodeLink } from "./NodeLink";
import { METRIC_ICON, PixelIcon } from "./PixelIcon";
import { SeverityBadge } from "./SeverityBadge";
import {
  hashString,
  pixelsToPaths,
  seededRandom,
  type Pixel,
} from "./map/pixels";
import { buildingLayers } from "./map/sprites";
import { BIOME_COLORS, biomeAt } from "./map/terrain";

export interface NodeGridProps {
  nodes: GridNode[];
  statuses: Record<string, NodeStatus>;
}

/** One card per node: its town on a strip of its own land, its status, and a pixel meter per metric. */
export function NodeGrid({ nodes, statuses }: NodeGridProps) {
  const { data: latest = {} } = useLatest();

  return (
    <div className="node-grid">
      {nodes.map((n) => {
        const status = statuses[n.id] ?? "ok";
        return (
          <NodeLink
            key={n.id}
            nodeId={n.id}
            className={`card node-card status-${status}`}
          >
            <TownScene node={n} status={status} />
            <div className="node-head">
              <span className="node-name">{n.name}</span>
              <SeverityBadge severity={status} />
            </div>
            <div className="node-region">{n.region}</div>
            <div className="node-meters">
              {METRICS.map((m) => (
                <PixelMeter key={m} metric={m} value={latest[n.id]?.[m]} />
              ))}
            </div>
          </NodeLink>
        );
      })}
    </div>
  );
}

// ---------- the town scene ----------

const SCENE_W = 48;
const SCENE_H = 24;

/**
 * The node's building from the map, standing on a strip of the land around it (same biome colours),
 * with a few trees, rocks or reeds. Corrupted nodes get purple corruption on the ground.
 */
export function TownScene({ node, status, className = "town-scene" }: { node: GridNode; status: NodeStatus; className?: string }) {
  const scene = useMemo(() => {
    const biome = biomeAt(node.x * 2, node.y * 2);
    const [ground, groundDark] =
      BIOME_COLORS[biome === "river" ? "grass" : biome];
    const random = seededRandom(hashString(node.id));
    const land: Pixel[] = [
      { x: 0, y: 19, w: SCENE_W, h: 5, color: ground },
      { x: 0, y: 23, w: SCENE_W, h: 1, color: groundDark },
    ];
    // small decorations left and right of the building
    for (const x of [3, 8, 37, 43]) {
      if (random() < 0.25) continue;
      land.push(
        { x, y: 16, w: 1, h: 1, color: "#3f7a43" },
        { x: x - 1, y: 17, w: 3, h: 1, color: "#336b38" },
        { x, y: 18, w: 1, h: 1, color: "#4a2f1a" },
      );
    }
    const building = buildingLayers(node.id, SCENE_W / 2, 19);
    return {
      land: pixelsToPaths(land),
      building: pixelsToPaths(building.pixels),
      animated: building.animated.map((a) => ({
        className: a.className,
        paths: pixelsToPaths(a.pixels),
      })),
    };
  }, [node]);

  const corruption = useMemo(() => {
    if (status !== "high" && status !== "critical") return [];
    const random = seededRandom(hashString(node.id + status));
    const amount = status === "critical" ? 26 : 14;
    const colors = ["#3a1048", "#5e1a80", "#7a2290", "#e04fd0"];
    return pixelsToPaths(
      Array.from({ length: amount }, () => ({
        x: Math.floor(random() * SCENE_W),
        y: 17 + Math.floor(random() * 7),
        w: 2,
        h: 1,
        color: colors[Math.floor(random() * colors.length)],
      })),
    );
  }, [node, status]);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {scene.land.map((p) => (
        <path key={p.color} d={p.d} fill={p.color} />
      ))}
      {corruption.map((p) => (
        <path
          key={p.color}
          d={p.d}
          fill={p.color}
          className="scene-corruption"
        />
      ))}
      <g className={`scene-building status-${status}`}>
        {status === "critical" &&
          scene.building.map((p) => (
            <g key={`split-${p.color}`}>
              <path d={p.d} transform="translate(-1 0)" className="split-r" />
              <path d={p.d} transform="translate(1 0)" className="split-c" />
            </g>
          ))}
        {scene.building.map((p) => (
          <path key={p.color} d={p.d} fill={p.color} />
        ))}
        {scene.animated.map((layer) => (
          <g key={layer.className} className={layer.className}>
            {layer.paths.map((p) => (
              <path key={p.color} d={p.d} fill={p.color} />
            ))}
          </g>
        ))}
        {(status === "high" || status === "critical") &&
          scene.building.map((p) => (
            <path key={`stain-${p.color}`} d={p.d} className="stain" />
          ))}
      </g>
    </svg>
  );
}

// ---------- pixel meter ----------

const SEGMENTS = 12;

/** Segmented bar from 0 to the metric's hard limit: blue while safe, orange near the limit, red over it. */
function PixelMeter({
  metric,
  value,
}: {
  metric: Metric;
  value: number | undefined;
}) {
  const limit = HARD_LIMITS[metric]?.max ?? 100;
  const ratio = value === undefined ? 0 : Math.max(0, value / limit);
  const filled = Math.min(SEGMENTS, Math.round(ratio * SEGMENTS));
  const tone = ratio >= 1 ? "critical" : ratio >= 0.85 ? "high" : "ok";

  return (
    <div
      className={`pmeter tone-${tone}`}
      title={`${METRIC_INFO[metric].label}: ${fmt(metric, value)} ${METRIC_INFO[metric].unit} (limit ${limit})`}
    >
      <div className="pmeter-head">
        <span className="pmeter-label">
          <PixelIcon name={METRIC_ICON[metric]} size={18} />
          {METRIC_INFO[metric].label}
        </span>
        <span className="pmeter-value">
          {fmt(metric, value)}
          <small>{METRIC_INFO[metric].unit}</small>
        </span>
      </div>
      <div className="pmeter-bar" aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i} className={i < filled ? "on" : ""} />
        ))}
      </div>
    </div>
  );
}
