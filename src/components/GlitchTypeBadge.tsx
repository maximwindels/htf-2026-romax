import { PixelIcon, type PixelIconName } from "#/components/grid/PixelIcon.tsx";
import { GLITCH_TYPE_INFO, type GlitchType } from "#/lib/glitch.ts";

/** The kind of glitch the AI sorted it into, as a pixel icon with a coloured label. */
export function GlitchTypeBadge({
  type,
  compact = false,
}: {
  type: GlitchType | null | undefined;
  compact?: boolean;
}) {
  if (!type) return null;
  const info = GLITCH_TYPE_INFO[type];
  return (
    <span
      className="type-badge"
      style={{ color: info.color }}
      title={`${info.label}: ${info.hint} (sorted by AI)`}
    >
      <PixelIcon name={info.icon as PixelIconName} size={compact ? 14 : 18} />
      {!compact && info.label}
    </span>
  );
}
