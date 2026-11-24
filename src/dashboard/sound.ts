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

// ---------- glitch stinger ----------

/**
 * The Desync strikes back: a heavy, distorted hit. A burst of filtered noise sweeping down,
 * over a detuned saw that drops in pitch. About 0.9 s.
 */
export function playStinger() {
  if (!isSoundOn()) return;
  const audio = audioContext();
  if (!audio) return;
  const t = audio.currentTime;

  const out = audio.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
  out.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  out.connect(audio.destination);

  // Noise burst through a low-pass that closes fast: the "crunch".
  const length = Math.floor(audio.sampleRate * 0.9);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1;
  const noise = audio.createBufferSource();
  noise.buffer = buffer;
  const lowpass = audio.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(4000, t);
  lowpass.frequency.exponentialRampToValueAtTime(120, t + 0.7);
  const noiseGain = audio.createGain();
  noiseGain.gain.value = 0.6;
  noise.connect(lowpass).connect(noiseGain).connect(out);

  // Two detuned saws dropping an octave and a half: the "weight".
  for (const detune of [-25, 25]) {
    const saw = audio.createOscillator();
    saw.type = 'sawtooth';
    saw.detune.value = detune;
    saw.frequency.setValueAtTime(110, t);
    saw.frequency.exponentialRampToValueAtTime(38, t + 0.8);
    const g = audio.createGain();
    g.gain.value = 0.35;
    saw.connect(g).connect(out);
    saw.start(t);
    saw.stop(t + 0.9);
  }
  noise.start(t);
  noise.stop(t + 0.9);
}

// ---------- Rune Sequence tones ----------

/** One note per rune: a pentatonic scale (G A C D E), so any sequence sounds like a melody. */
const RUNE_NOTES = [392, 440, 523.25, 587.33, 659.25];

export function playRuneTone(rune: number, durationMs = 420) {
  if (!isSoundOn()) return;
  const audio = audioContext();
  if (!audio) return;
  const t = audio.currentTime;
  const end = t + durationMs / 1000;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'triangle';
  osc.frequency.value = RUNE_NOTES[rune % RUNE_NOTES.length];
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.08, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(end + 0.02);
}

/** A wrong rune: a short low buzz. */
export function playRuneError() {
  if (!isSoundOn()) return;
  const audio = audioContext();
  if (!audio) return;
  const t = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.25);
  gain.gain.setValueAtTime(0.06, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + 0.32);
}
