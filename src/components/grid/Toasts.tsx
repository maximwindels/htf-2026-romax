import { dismiss, useToasts } from '#/dashboard/alerts';
import { SeverityBadge } from './SeverityBadge';

/** Parchment pop-ups in the bottom-right corner. Click one to close it. */
export function Toasts() {
  const toasts = useToasts();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.key} className={`toast sev-${t.tone}`} onClick={() => dismiss(t.key)}>
          <SeverityBadge severity={t.tone} /> <strong>{t.title}</strong>
          <div className="small">{t.message}</div>
        </div>
      ))}
    </div>
  );
}
