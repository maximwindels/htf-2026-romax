/**
 * Sound design for The Desync. Everything goes through one AudioContext (also used by the alert
 * beeps in alerts.ts) and respects the sound toggle in the top bar, which is off by default.
 *
 * - Ambient hum: a low drone whose pitch sinks and wobbles as the magic stability drops.
 * - Stabilize chime: a rising arpeggio when a glitch or critical anomaly is stabilized.
 */
import { isSoundOn } from './alerts';

let ctx: AudioContext | null = null;

/** The shared AudioContext, created lazily (browsers only allow sound after a user gesture). */
export function audioContext(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null; // no Web Audio (old browser, server render)
  }
}

// ---------- ambient hum ----------

type Hum = {
  low: OscillatorNode;
  high: OscillatorNode;
  lfo: OscillatorNode;
  lfoDepth: GainNode;
  out: GainNode;
};
let hum: Hum | null = null;

const HUM_VOLUME = 0.045;

function startHum(audio: AudioContext): Hum {
  const out = audio.createGain();
  out.gain.value = 0;
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  filter.connect(out).connect(audio.destination);

  // Two voices: a sine drone and a soft triangle an octave up, detuned more as magic drops.
  const low = audio.createOscillator();
  low.type = 'sine';
  const high = audio.createOscillator();
  high.type = 'triangle';
  const highGain = audio.createGain();
  highGain.gain.value = 0.35;
  low.connect(filter);
  high.connect(highGain).connect(filter);

  // Tremolo: faster and deeper the worse it gets.
  const lfo = audio.createOscillator();
  const lfoDepth = audio.createGain();
  lfoDepth.gain.value = 0;
  lfo.connect(lfoDepth).connect(out.gain);

  low.start();
  high.start();
  lfo.start();
  return { low, high, lfo, lfoDepth, out };
}

/**
 * Keeps the hum in tune with the magic stability (0-100). Pass null to fade it out.
 * Healthy grid: a calm ~88 Hz drone. Near 0 %: a sagging ~48 Hz drone that beats and pulses.
 */
export function setHum(stability: number | null) {
  if (stability === null || !isSoundOn()) {
    if (hum && ctx) {
      const h = hum;
      hum = null;
      h.out.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      setTimeout(() => [h.low, h.high, h.lfo].forEach((o) => o.stop()), 1500);
    }
    return;
  }

  const audio = audioContext();
  if (!audio) return;
  hum ??= startHum(audio);

  const health = Math.max(0, Math.min(100, stability)) / 100;
  const unrest = 1 - health;
  const t = audio.currentTime;
  const base = 48 + health * 40;
  hum.low.frequency.setTargetAtTime(base, t, 0.8);
  hum.high.frequency.setTargetAtTime(base * 2, t, 0.8);
  hum.high.detune.setTargetAtTime(unrest * 35, t, 0.8); // beating = unease
  hum.lfo.frequency.setTargetAtTime(0.15 + unrest * 4, t, 0.8);
  hum.lfoDepth.gain.setTargetAtTime(HUM_VOLUME * 0.6 * unrest, t, 0.8);
  hum.out.gain.setTargetAtTime(HUM_VOLUME, t, 0.5);
}

// ---------- stabilize chime ----------

/** Rising C-major arpeggio: the satisfying "it's fixed" sound. */
export function playStabilized() {
  if (!isSoundOn()) return;
  const audio = audioContext();
  if (!audio) return;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const start = audio.currentTime + i * 0.09;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.07, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + 0.75);
  });
}
