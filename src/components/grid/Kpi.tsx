import { useEffect, useState } from 'react';
import type { NodeStatus } from '#/dashboard/hooks';
import { useDesyncLevel } from '#/dashboard/desync';

export interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  /** colours the card: ok = blue, medium = purple, high = orange, critical = red */
  tone?: NodeStatus;
}

/** One KPI card on the overview. */
export function Kpi({ label, value, sub, tone = 'ok' }: KpiProps) {
  return (
    <div className={`card kpi tone-${tone}`}>
      <div className="kpi-label">{label}</div>
      <CorruptibleValue seed={label} value={value} />
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

const CORRUPT_TEXT = ['0x4F_CORRUPT', '0x4F_C0RRUPT', '0xDE_5YNC', '█▓▒░ ERR', '0x00_NULL'];

/** Stable small hash, so the same KPIs get corrupted each time instead of random ones per render. */
function hash(text: string) {
  let h = 7;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Shows the value, unless The Desync has eaten it: from level 2, one in four KPIs turns into
 * hex garbage, from level 3 one in two. They come back once a defender restores the magic.
 */
function CorruptibleValue({ seed, value }: { seed: string; value: string }) {
  const level = useDesyncLevel();
  const corrupted = level >= 2 && hash(seed) % 4 < (level === 3 ? 2 : 1);
  const [frame, setFrame] = useState(0);

  // Corrupted text flickers between garbage variants.
  useEffect(() => {
    if (!corrupted) return;
    const id = setInterval(() => setFrame((f) => f + 1), 900);
    return () => clearInterval(id);
  }, [corrupted]);

  if (!corrupted) return <div className="kpi-value">{value}</div>;
  return (
    <div className="kpi-value corrupt" title="Corrupted by The Desync: stabilize critical alerts to restore it">
      {CORRUPT_TEXT[(hash(seed) + frame) % CORRUPT_TEXT.length]}
    </div>
  );
}
