import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eraser } from 'lucide-react';
import { api, qk } from '#/dashboard/api';
import { TROUBLE_MODES, TROUBLE_MODE_INFO, type TroubleMode } from '#/lib/grid.ts';

/**
 * Commander demo controls for how much The Desync attacks by itself (calm / normal / chaos),
 * and a testing button that clears every open alert at once (also the critical ones,
 * which normally need the stabilizer).
 */
export function TroubleControls() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: qk.simMode, queryFn: api.simMode, staleTime: Infinity });
  const mode = data?.mode;

  const setMode = useMutation({
    mutationFn: api.setSimMode,
    onSuccess: (res) => qc.setQueryData(qk.simMode, res),
  });
  const clear = useMutation({ mutationFn: api.clearAll });

  return (
    <div className="trouble-controls">
      <div className="trouble-modes" role="radiogroup" aria-label="Random trouble">
        <span className="trouble-label">Errors</span>
        {TROUBLE_MODES.map((m: TroubleMode) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            className={`btn-small trouble-mode mode-${m} ${mode === m ? 'is-active' : 'ghost'}`}
            disabled={setMode.isPending}
            onClick={() => setMode.mutate(m)}
            title={TROUBLE_MODE_INFO[m].hint}
          >
            {TROUBLE_MODE_INFO[m].label}
          </button>
        ))}
      </div>
      <button
        className="btn-small ghost inline-flex items-center gap-1.5"
        disabled={clear.isPending}
        onClick={() => clear.mutate()}
        title="Testing: stops all running trouble and acknowledges every open alert, critical ones included"
      >
        <Eraser className="size-4" />
        {clear.isSuccess && !clear.isPending ? `Cleared ${clear.data.acknowledged}` : 'Clear all errors'}
      </button>
    </div>
  );
}
