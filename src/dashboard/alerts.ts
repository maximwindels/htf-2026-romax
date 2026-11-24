import { useSyncExternalStore } from 'react';
import { METRIC_INFO, type Anomaly, type EarlyWarning, type Severity } from '#/lib/grid.ts';
import { playAlert, playToggleOn } from './sound';

// Tiny external store for toasts + sound, so the SSE handler can notify without React context.

export interface Toast {
  key: string;
  tone: Severity | 'warning';
  title: string;
  message: string;
}

let toasts: Toast[] = [];
let soundOn = false;
let flashUntil = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};


function push(t: Toast, ms = 7000) {
  toasts = [t, ...toasts.filter((x) => x.key !== t.key)].slice(0, 4);
  emit();
  setTimeout(() => dismiss(t.key), ms);
}

export function notify(a: Anomaly) {
  if (a.severity === 'medium') return; // keep the toast stream for things that matter
  if (a.severity === 'critical') {
    flashUntil = Date.now() + 1600;
    if (soundOn) playAlert('critical');
  } else if (soundOn) {
    playAlert('high');
  }
  push({ key: `a${a.id}`, tone: a.severity, title: a.nodeId, message: a.message });
}

export function notifyWarning(w: EarlyWarning) {
  const info = METRIC_INFO[w.metric];
  if (soundOn) playAlert('warning');
  push(
    {
      key: `w${w.id}`,
      tone: 'warning',
      title: `Early warning · ${w.nodeId}`,
      message: `${info.label} trending to ${w.limitValue} ${info.unit} in ~${Math.round(w.etaSeconds)} s`,
    },
    9000,
  );
}

export function dismiss(key: string) {
  const next = toasts.filter((t) => t.key !== key);
  if (next.length !== toasts.length) {
    toasts = next;
    emit();
  }
}

export const isSoundOn = () => soundOn;

export function toggleSound() {
  soundOn = !soundOn;
  if (soundOn) playToggleOn(); // also unlocks the AudioContext on user gesture
  emit();
}

// The third argument is the value during the server render: no toasts, sound off, no flash.
const NO_TOASTS: Toast[] = [];
export const useToasts = () => useSyncExternalStore(subscribe, () => toasts, () => NO_TOASTS);
export const useSoundOn = () => useSyncExternalStore(subscribe, () => soundOn, () => false);
export const useFlash = () => useSyncExternalStore(subscribe, () => flashUntil, () => 0);
