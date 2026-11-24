import { Check } from "lucide-react";
import {
  GLITCH_STATUSES,
  STATUS_DESCRIPTIONS,
  STATUS_LABELS,
  type GlitchStatus,
} from "#/lib/glitch.ts";

/** Solid colour per status, the same family as the status badges. */
const STEP_COLORS: Record<GlitchStatus, string> = {
  LEAKED: "bg-red-400 border-red-400",
  ASSESSING: "bg-amber-400 border-amber-400",
  CONTAINING: "bg-sky-400 border-sky-400",
  FIXED: "bg-emerald-400 border-emerald-400",
};

/** The glitch lifecycle LEAKED > ASSESSING > CONTAINING > FIXED, with the current step highlighted. */
export function StatusStepper({ status }: { status: GlitchStatus }) {
  const current = GLITCH_STATUSES.indexOf(status);

  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Glitch lifecycle">
      {GLITCH_STATUSES.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={step}
            aria-current={active ? "step" : undefined}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              {/* square marker = pixel style, like the app's live dot */}
              <span
                className={`flex size-6 shrink-0 items-center justify-center border-2 text-xs font-bold text-app ${
                  done || active
                    ? STEP_COLORS[step]
                    : "border-line bg-transparent text-muted"
                }`}
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              {i < GLITCH_STATUSES.length - 1 && (
                <span
                  className={`h-0.5 flex-1 ${done ? "bg-fg/60" : "bg-line"}`}
                />
              )}
            </div>
            <div>
              <p
                className={`text-sm font-semibold ${active ? "text-fg" : "text-muted"}`}
              >
                {STATUS_LABELS[step]}
              </p>
              <p className="text-xs text-muted">{STATUS_DESCRIPTIONS[step]}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
