import { useEffect, useMemo, useState } from "react";
import {
  METRIC_INFO,
  METRICS,
  type Forecast,
  type GridNode,
} from "#/lib/grid.ts";
import { fmtUnit } from "#/dashboard/format";
import { useLatest, type NodeStatus } from "#/dashboard/hooks";
import { NodeLink } from "./NodeLink";
import {
  hashString,
  pixelsToPaths,
  seededRandom,
  type Pixel,
} from "./map/pixels";
import { buildingLayers, HUT, PALETTE } from "./map/sprites";
import { buildTerrain, MAP_H, MAP_W } from "./map/terrain";
import { spriteToPixels } from "./map/pixels";

export interface NetworkMapProps {
  nodes: GridNode[];
  statuses: Record<string, NodeStatus>;
  /** cities with an active forecast get an early-warning marker */
  forecasts?: Forecast[];
}

/** Node coordinates are 0-100 x 0-70; the pixel map is twice that, so one unit = one pixel. */
const SCALE = 2;
/** Buildings are drawn this much bigger than the terrain pixels, so they read well at dashboard size. */
const BUILDING_ZOOM = 1.4;

/** How a city looks on the map. "threatened" = healthy, but a corrupted neighbour is spreading to it. */
type CityState = "ok" | "warning" | "threatened" | NodeStatus;

const STATE_LABEL: Record<CityState, string> = {
  ok: "Stable",
  warning: "Early warning: trending to a limit",
  threatened: "Threatened by a corrupted neighbour",
  medium: "Unstable",
  high: "Corrupted",
  critical: "Critical corruption",
};

const FLAG_COLOR: Partial<Record<CityState, string>> = {
  medium: "#e292f4",
  high: "#f48d30",
  critical: "#eb4c2d",
};

/** Corruption spreads over the land around a city: radius in map pixels per severity. */
const CORRUPTION_RADIUS: Partial<Record<NodeStatus, number>> = {
  medium: 9,
  high: 15,
  critical: 22,
};
const isCorrupted = (s: NodeStatus) => s === "high" || s === "critical";

interface City extends GridNode {
  cx: number;
  cy: number;
}

// ---------- geometry ----------

/** Connect every city to its 2 nearest neighbours (each pair only once). */
function nearestLinks(cities: City[]): [City, City][] {
  const distance = (a: City, b: City) => Math.hypot(a.cx - b.cx, a.cy - b.cy);
  const seen = new Set<string>();
  const links: [City, City][] = [];
  for (const city of cities) {
    const nearest = cities
      .filter((other) => other.id !== city.id)
      .sort((a, b) => distance(city, a) - distance(city, b))
      .slice(0, 2);
    for (const other of nearest) {
      const key = [city.id, other.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      links.push([city, other]);
    }
  }
  return links;
}

/** A gently curved road from a to b (the bend is fixed per pair, so it never jumps). */
function roadPath(a: City, b: City) {
  const mx = (a.cx + b.cx) / 2;
  const my = (a.cy + b.cy) / 2;
  const len = Math.hypot(b.cx - a.cx, b.cy - a.cy) || 1;
  const bend =
    (hashString([a.id, b.id].sort().join("|")) % 2 ? 1 : -1) *
    Math.min(8, len * 0.12);
  // the bend is measured from the sorted pair, so a->b and b->a follow the same road
  const [p, q] = a.id < b.id ? [a, b] : [b, a];
  const nx = -(q.cy - p.cy) / len;
  const ny = (q.cx - p.cx) / len;
  return `M${a.cx} ${a.cy} Q${mx + nx * bend} ${my + ny * bend} ${b.cx} ${b.cy}`;
}

/** Small houses around a city, so each one looks like a town. */
function hutsAround(city: City): Pixel[] {
  const random = seededRandom(hashString(city.id));
  const spots = [
    [-15, 1],
    [11, 2],
    [-12, -7],
    [12, -6],
  ];
  const count = 2 + Math.floor(random() * 2);
  return spots
    .sort(() => random() - 0.5)
    .slice(0, count)
    .flatMap(([dx, dy]) =>
      spriteToPixels(HUT, PALETTE, city.cx + dx - 2, city.cy + 3 + dy - 3),
    );
}

/** Purple tiles creeping over the land around a corrupted city. Deterministic per city and severity. */
function corruptionAround(
  city: City,
  status: NodeStatus,
): { tiles: Pixel[]; sparks: Pixel[] } {
  const radius = CORRUPTION_RADIUS[status];
  if (!radius) return { tiles: [], sparks: [] };
  const random = seededRandom(hashString(city.id + status));
  const tiles: Pixel[] = [];
  const sparks: Pixel[] = [];
  const colors = ["#3a1048", "#5e1a80", "#7a2290"];
  for (let y = -radius; y <= radius; y += 2) {
    for (let x = -radius; x <= radius; x += 2) {
      const d = Math.hypot(x, y) / radius;
      if (d > 1 || random() > (1 - d) * 1.1) continue;
      tiles.push({
        x: city.cx + x,
        y: city.cy + y,
        w: 2,
        h: 2,
        color: colors[Math.floor(random() * colors.length)],
      });
      if (random() < 0.12)
        sparks.push({
          x: city.cx + x,
          y: city.cy + y,
          w: 1,
          h: 1,
          color: "#e04fd0",
        });
    }
  }
  return { tiles, sparks };
}

/**
 * Keep the hover card inside the map: above the town, or below it for towns near the top edge,
 * and shifted inwards for towns near the left or right edge.
 */
function tipTransform(city: City) {
  const fx = city.cx / MAP_W
  const x = fx < 0.25 ? '-15%' : fx > 0.75 ? '-85%' : '-50%'
  const y = city.cy / MAP_H < 0.4 ? '22px' : 'calc(-100% - 34px)'
  return `translate(${x}, ${y})`
}

// ---------- small hooks ----------

/** True when the user asked the OS for less motion: the SVG motion along the roads is then left out. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// ---------- the map ----------

/**
 * The map of Achrona: pixel terrain, a pixel town per node, roads with flowing mana between them.
 * Corruption shows on the land around a city, and spreads visibly along the roads to its neighbours.
 */
export function NetworkMap({
  nodes,
  statuses,
  forecasts = [],
}: NetworkMapProps) {
  const { data: latest = {} } = useLatest();
  const reducedMotion = usePrefersReducedMotion();
  const [hovered, setHovered] = useState<string | null>(null);

  const cities = useMemo<City[]>(
    () => nodes.map((n) => ({ ...n, cx: n.x * SCALE, cy: n.y * SCALE })),
    [nodes],
  );
  const terrain = useMemo(() => {
    const t = buildTerrain(cities.map((c) => ({ x: c.cx, y: c.cy })));
    return { land: pixelsToPaths(t.land), waves: pixelsToPaths(t.waves) };
  }, [cities]);
  const towns = useMemo(
    () =>
      cities.map((c) => {
        const building = buildingLayers(c.id, c.cx, c.cy + 3);
        return {
          city: c,
          building,
          staticPaths: pixelsToPaths(building.pixels),
          animated: building.animated.map((a) => ({
            className: a.className,
            paths: pixelsToPaths(a.pixels),
          })),
          huts: pixelsToPaths(hutsAround(c)),
        };
      }),
    [cities],
  );
  const links = useMemo(() => nearestLinks(cities), [cities]);

  const statusOf = (id: string): NodeStatus => statuses[id] ?? "ok";
  const watched = new Set(forecasts.map((f) => f.nodeId));
  const threatened = new Set<string>();
  for (const [a, b] of links) {
    if (isCorrupted(statusOf(a.id)) && !isCorrupted(statusOf(b.id)))
      threatened.add(b.id);
    if (isCorrupted(statusOf(b.id)) && !isCorrupted(statusOf(a.id)))
      threatened.add(a.id);
  }
  const stateOf = (id: string): CityState => {
    const s = statusOf(id);
    if (s !== "ok") return s;
    if (watched.has(id)) return "warning";
    return threatened.has(id) ? "threatened" : "ok";
  };

  const corruption = useMemo(() => {
    const all = cities.map((c) => corruptionAround(c, statuses[c.id] ?? "ok"));
    return {
      tiles: pixelsToPaths(all.flatMap((c) => c.tiles)),
      sparks: pixelsToPaths(all.flatMap((c) => c.sparks)),
    };
  }, [cities, statuses]);

  const hoveredCity = cities.find((c) => c.id === hovered);

  return (
    <div className="card map-card">
      <div className="card-title">Map of Achrona · ley lines</div>
      <div className="map-frame">
        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          className="map pixel-map"
          role="img"
          aria-label="Map of Achrona with the status of every node"
        >
          {/* ---- land ---- */}
          <g shapeRendering="crispEdges">
            {terrain.land.map((p) => (
              <path key={p.color} d={p.d} fill={p.color} />
            ))}
            <g className="px-waves">
              {terrain.waves.map((p) => (
                <path key={p.color} d={p.d} fill={p.color} />
              ))}
            </g>
          </g>

          {/* ---- corruption creeping over the land ---- */}
          <g shapeRendering="crispEdges" className="corruption">
            {corruption.tiles.map((p) => (
              <path key={p.color} d={p.d} fill={p.color} />
            ))}
            <g className="corrupt-sparks">
              {corruption.sparks.map((p) => (
                <path key={p.color} d={p.d} fill={p.color} />
              ))}
            </g>
          </g>

          {/* ---- roads + ley lines ---- */}
          {links.map(([a, b], i) => {
            const aBad = isCorrupted(statusOf(a.id));
            const bBad = isCorrupted(statusOf(b.id));
            const spreading = aBad !== bBad;
            // draw the ley line from the corrupted city to the healthy one, so the flow shows the spread
            const [from, to] = spreading && bBad ? [b, a] : [a, b];
            const d = roadPath(from, to);
            const kind = aBad && bBad ? "corrupt" : spreading ? "spread" : "ok";
            return (
              <g key={a.id + b.id}>
                <path d={d} className="road-edge" />
                <path d={d} className="road" />
                <path d={d} className={`ley ley-${kind}`} />
                {kind === "spread" && !reducedMotion && (
                  <g className="spread-blob">
                    <rect
                      x={-1.6}
                      y={-1.6}
                      width={3.2}
                      height={3.2}
                      className="spread-blob-edge"
                    />
                    <rect
                      x={-1.1}
                      y={-1.1}
                      width={2.2}
                      height={2.2}
                      className="spread-blob-core"
                    />
                    <animateMotion
                      dur="3.2s"
                      begin={`${(i % 4) * 0.7}s`}
                      repeatCount="indefinite"
                      path={d}
                    />
                  </g>
                )}
              </g>
            );
          })}

          {/* ---- towns ---- */}
          {towns.map(({ city, building, staticPaths, animated, huts }) => {
            const state = stateOf(city.id);
            // Buildings are drawn BUILDING_ZOOM times bigger, growing up from their ground line.
            const ground = city.cy + 3;
            const zoom = `translate(${city.cx} ${ground}) scale(${BUILDING_ZOOM}) translate(${-city.cx} ${-ground})`;
            const top = ground - building.height * BUILDING_ZOOM;
            const labelWidth = city.name.length * 2.35 + 4;
            return (
              <NodeLink key={city.id} nodeId={city.id}>
                <g
                  className={`town state-${state}`}
                  onMouseEnter={() => setHovered(city.id)}
                  onMouseLeave={() =>
                    setHovered((h) => (h === city.id ? null : h))
                  }
                  onFocus={() => setHovered(city.id)}
                  onBlur={() => setHovered((h) => (h === city.id ? null : h))}
                >
                  <title>{`${city.name}: ${STATE_LABEL[state]}`}</title>
                  {/* hit area: easier to hover and tap than the pixels alone */}
                  <rect
                    x={city.cx - 14}
                    y={top - 4}
                    width={28}
                    height={building.height + 14}
                    className="town-hit"
                  />

                  <g shapeRendering="crispEdges">
                    {huts.map((p) => (
                      <path key={p.color} d={p.d} fill={p.color} />
                    ))}

                    <g transform={zoom}>
                    {/* critical: the building splits into red/cyan copies, like the Desync on screen */}
                    {state === "critical" &&
                      staticPaths.map((p) => (
                        <g key={`split-${p.color}`}>
                          <path
                            d={p.d}
                            transform="translate(-1 0)"
                            className="split-r"
                          />
                          <path
                            d={p.d}
                            transform="translate(1 0)"
                            className="split-c"
                          />
                        </g>
                      ))}

                    <g className="building">
                      {staticPaths.map((p) => (
                        <path key={p.color} d={p.d} fill={p.color} />
                      ))}
                      {animated.map((layer) => (
                        <g key={layer.className} className={layer.className}>
                          {layer.paths.map((p) => (
                            <path key={p.color} d={p.d} fill={p.color} />
                          ))}
                        </g>
                      ))}
                    </g>

                    {/* corrupted: a purple stain over the building */}
                    {isCorrupted(statusOf(city.id)) &&
                      staticPaths.map((p) => (
                        <path
                          key={`stain-${p.color}`}
                          d={p.d}
                          className="stain"
                        />
                      ))}
                    </g>

                    {/* status flag on a pole, or a blinking "!" for an early warning */}
                    {FLAG_COLOR[state] && (
                      <g className="flag">
                        <rect
                          x={city.cx + 8.5}
                          y={top - 6}
                          width={0.8}
                          height={8}
                          fill="#140c1c"
                        />
                        <rect
                          x={city.cx + 9.3}
                          y={top - 6}
                          width={4}
                          height={2.6}
                          fill={FLAG_COLOR[state]}
                        />
                      </g>
                    )}
                    {state === "warning" && (
                      <g className="warn-mark">
                        <rect
                          x={city.cx - 1}
                          y={top - 9}
                          width={2}
                          height={4}
                          fill="#e1e7ff"
                        />
                        <rect
                          x={city.cx - 1}
                          y={top - 4}
                          width={2}
                          height={1.5}
                          fill="#e1e7ff"
                        />
                      </g>
                    )}
                    {state === "threatened" && (
                      <rect
                        x={city.cx - 13}
                        y={top - 3}
                        width={26}
                        height={building.height + 6}
                        className="threat-ring"
                      />
                    )}
                  </g>

                  {/* name plate */}
                  <rect
                    x={city.cx - labelWidth / 2}
                    y={city.cy + 4.5}
                    width={labelWidth}
                    height={5.4}
                    className="plate"
                  />
                  <text
                    x={city.cx}
                    y={city.cy + 8.6}
                    textAnchor="middle"
                    className="plate-text"
                  >
                    {city.name}
                  </text>
                </g>
              </NodeLink>
            );
          })}
        </svg>

        {hoveredCity && (
          <div
            className="map-tip"
            style={{
              left: `${(hoveredCity.cx / MAP_W) * 100}%`,
              top: `${(hoveredCity.cy / MAP_H) * 100}%`,
              transform: tipTransform(hoveredCity),
            }}
            role="status"
          >
            <div className="map-tip-head">
              <strong>{hoveredCity.name}</strong>
              <span className="muted small">{hoveredCity.region}</span>
            </div>
            <div className={`map-tip-state state-${stateOf(hoveredCity.id)}`}>
              {STATE_LABEL[stateOf(hoveredCity.id)]}
            </div>
            <dl>
              {METRICS.map((m) => (
                <div key={m}>
                  <dt>{METRIC_INFO[m].label}</dt>
                  <dd>{fmtUnit(m, latest[hoveredCity.id]?.[m])}</dd>
                </div>
              ))}
            </dl>
            <div className="muted small">Click to open</div>
          </div>
        )}
      </div>

      <ul className="map-legend">
        <li>
          <span className="lg lg-ley" /> Mana flow
        </li>
        <li>
          <span className="lg lg-spread" /> Corruption spreading
        </li>
        <li>
          <span className="lg lg-corrupt" /> Corrupted land
        </li>
        <li>
          <span className="lg lg-warning" /> Early warning
        </li>
        <li>
          <span className="lg lg-threat" /> Threatened
        </li>
      </ul>
    </div>
  );
}
