import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { StabilizeGame } from '#/components/StabilizeGame';
import { api } from '#/dashboard/api';
import { useAck, useStoreAck } from '#/dashboard/hooks';
import { METRIC_INFO, type Anomaly } from '#/lib/grid.ts';
import { anomalySeed } from '#/lib/stabilize.ts';

/**
 * Clears an open anomaly. Medium and high: a plain Acknowledge. Critical: the Desync has to be
 * stabilized with the mini-game first; the server refuses a plain ack (see api/anomalies.$id.ack).
 */
export function AckButton({ anomaly, label = 'Acknowledge' }: { anomaly: Anomaly; label?: string }) {
  const ack = useAck();
  const [stabilizing, setStabilizing] = useState(false);

  if (anomaly.severity !== 'critical') {
    return (
      <button className="btn-small" disabled={ack.isPending} onClick={() => ack.mutate(anomaly.id)}>
        {label}
      </button>
    );
  }

  return (
    <>
      <button className="btn-small danger" onClick={() => setStabilizing(true)} title="Critical: stabilize to clear">
        Stabilize
      </button>
      {stabilizing && <StabilizeDialog anomaly={anomaly} onClose={() => setStabilizing(false)} />}
    </>
  );
}

function StabilizeDialog({ anomaly, onClose }: { anomaly: Anomaly; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const store = useStoreAck();

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="grid-ui m-auto w-full max-w-2xl overflow-visible bg-transparent p-0 backdrop:bg-black/70"
    >
      <div className="relative">
        {/* Above the panel, so it doesn't cover the status badge. */}
        <button
          type="button"
          className="btn-small ghost absolute -top-10 right-0 z-10 inline-flex items-center gap-1 !text-[#e1e7ff]"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="size-4" /> Close
        </button>
        <StabilizeGame
          seed={anomalySeed(anomaly.id)}
          autoFocus
          hints={{
            tune: (
              <>
                Critical Desync on <strong>{anomaly.nodeId}</strong> ({METRIC_INFO[anomaly.metric].label}). It can't
                just be acknowledged: tune onto its signal and hold for 2 seconds.
              </>
            ),
            pulse: (
              <>
                Critical Desync on <strong>{anomaly.nodeId}</strong> ({METRIC_INFO[anomaly.metric].label}). Press{' '}
                <kbd className="kbd">Space</kbd> or tap while the hand is in the zone, twice in a row.
              </>
            ),
          }}
          doneLabel={`${anomaly.nodeId} stabilized`}
          onStabilize={async (proof, run) => store(await api.ack(anomaly.id, proof, run))}
          onDone={onClose}
        />
      </div>
    </dialog>
  );
}
