/**
 * Sound design for The Desync. Everything goes through one AudioContext and one master bus
 * (compressor + a generated reverb), and respects the sound toggle in the top bar (off by default).
 *
 * Building blocks: `tone` (an oscillator with an envelope), `bell` (a tone with bell-like partials),
 * `noise` (filtered noise bursts). Every sound below is made from those, so they share one space.
 *
 * - Ambient hum: a low drone that sinks, beats and pulses as the magic drops.
 * - Alerts, stabilize chimes, the Desync stinger, game feedback (runes, pulse hits, timer ticks)
 *   and the swell when the Desync level changes.
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

// ---------- master bus: compressor + reverb ----------

type Bus = { input: GainNode; reverb: GainNode };
let bus: Bus | null = null;

/** A few seconds of decaying stereo noise: a cheap but convincing hall impulse. */
function impulse(audio: AudioContext, seconds = 2.4, decay = 3) {
  const length = Math.floor(audio.sampleRate * seconds);
  const buffer = audio.createBuffer(2, length, audio.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return buffer;
}

/** Everything plays into `input` (dry) and optionally `reverb` (wet send); both end in a compressor. */
function getBus(audio: AudioContext): Bus {
  if (bus) return bus;
  const compressor = audio.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.2;
  const master = audio.createGain();
  master.gain.value = 0.9;
  compressor.connect(master).connect(audio.destination);

  const input = audio.createGain();
  input.connect(compressor);

  const convolver = audio.createConvolver();
  convolver.buffer = impulse(audio);
  const wet = audio.createGain();
  wet.gain.value = 0.55;
  const reverb = audio.createGain();
  reverb.connect(convolver).connect(wet).connect(compressor);

  bus = { input, reverb };
  return bus;
}

/** The context and bus, or null when sound is off or unavailable. */
function ready(): { audio: AudioContext; out: Bus } | null {
  if (!isSoundOn()) return null;
  const audio = audioContext();
  if (!audio) return null;
  return { audio, out: getBus(audio) };
}

// ---------- building blocks ----------

type ToneOptions = {
  freq: number;
  /** Seconds from now. */
  at?: number;
  /** Seconds until silent. */
  dur: number;
  peak: number;
  type?: OscillatorType;
  attack?: number;
  /** Slide the pitch to this frequency over the duration. */
  glideTo?: number;
  detune?: number;
  /** Low-pass cutoff in Hz (none if omitted). */
  lowpass?: number;
  /** Reverb send, 0-1. */
  space?: number;
  /** Play into this node instead of the master bus input (e.g. the music's own fader). */
  dest?: AudioNode;
};

function tone(audio: AudioContext, out: Bus, o: ToneOptions) {
  const start = audio.currentTime + (o.at ?? 0);
  const end = start + o.dur;
  const osc = audio.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, start);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, end);
  if (o.detune) osc.detune.value = o.detune;

  const env = audio.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(o.peak, start + (o.attack ?? 0.005));
  env.gain.exponentialRampToValueAtTime(0.0001, end);

  let node: AudioNode = osc.connect(env);
  if (o.lowpass) {
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = o.lowpass;
    node = node.connect(filter);
  }
  node.connect(o.dest ?? out.input);
  if (o.space) {
    const send = audio.createGain();
    send.gain.value = o.space;
    node.connect(send).connect(out.reverb);
  }
  osc.start(start);
  osc.stop(end + 0.05);
}

/** A struck bell: the fundamental plus inharmonic partials that die away faster. */
function bell(audio: AudioContext, out: Bus, freq: number, at: number, dur: number, peak: number, space = 0.35) {
  // Dark, heavy bells: the bright upper partials are kept low and short.
  const partials: [number, number, number][] = [
    // [ratio, relative gain, relative length]
    [1, 1, 1],
    [2.01, 0.3, 0.6],
    [2.76, 0.18, 0.3],
    [5.4, 0.04, 0.12],
  ];
  for (const [ratio, gain, length] of partials) {
    tone(audio, out, { freq: freq * ratio, at, dur: dur * length, peak: peak * gain, attack: 0.003, space });
  }
}

type NoiseOptions = {
  at?: number;
  dur: number;
  peak: number;
  filter: BiquadFilterType;
  from: number;
  to?: number;
  space?: number;
  dest?: AudioNode;
};

let noiseBuffer: AudioBuffer | null = null;

function noise(audio: AudioContext, out: Bus, o: NoiseOptions) {
  if (!noiseBuffer) {
    noiseBuffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const start = audio.currentTime + (o.at ?? 0);
  const end = start + o.dur;
  const src = audio.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const filter = audio.createBiquadFilter();
  filter.type = o.filter;
  filter.frequency.setValueAtTime(o.from, start);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, end);
  const env = audio.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(o.peak, start + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  const node = src.connect(filter).connect(env);
  node.connect(o.dest ?? out.input);
  if (o.space) {
    const send = audio.createGain();
    send.gain.value = o.space;
    node.connect(send).connect(out.reverb);
  }
  src.start(start);
  src.stop(end + 0.05);
}

// ---------- ambient hum ----------

type Hum = {
  low: OscillatorNode;
  high: OscillatorNode;
  lfo: OscillatorNode;
  lfoDepth: GainNode;
  sweep: OscillatorNode;
  out: GainNode;
};
let hum: Hum | null = null;

const HUM_VOLUME = 0.05;

function startHum(audio: AudioContext, out: Bus): Hum {
  const gain = audio.createGain();
  gain.gain.value = 0;
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  filter.Q.value = 2;
  filter.connect(gain);
  gain.connect(out.input);
  const send = audio.createGain();
  send.gain.value = 0.25;
  gain.connect(send).connect(out.reverb);

  // Two voices: a sine drone and a soft triangle an octave up, detuned more as magic drops.
  const low = audio.createOscillator();
  low.type = 'sine';
  const high = audio.createOscillator();
  high.type = 'triangle';
  const highGain = audio.createGain();
  highGain.gain.value = 0.35;
  low.connect(filter);
  high.connect(highGain).connect(filter);

  // A slow filter sweep, so the drone breathes instead of sitting still.
  const sweep = audio.createOscillator();
  sweep.frequency.value = 0.12;
  const sweepDepth = audio.createGain();
  sweepDepth.gain.value = 120;
  sweep.connect(sweepDepth).connect(filter.frequency);

  // Tremolo: faster and deeper the worse it gets.
  const lfo = audio.createOscillator();
  const lfoDepth = audio.createGain();
  lfoDepth.gain.value = 0;
  lfo.connect(lfoDepth).connect(gain.gain);

  for (const o of [low, high, sweep, lfo]) o.start();
  return { low, high, lfo, lfoDepth, sweep, out: gain };
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
      setTimeout(() => [h.low, h.high, h.lfo, h.sweep].forEach((o) => o.stop()), 1500);
    }
    return;
  }
  const r = ready();
  if (!r) return;
  hum ??= startHum(r.audio, r.out);

  const health = Math.max(0, Math.min(100, stability)) / 100;
  const unrest = 1 - health;
  const t = r.audio.currentTime;
  const base = 48 + health * 40;
  hum.low.frequency.setTargetAtTime(base, t, 0.8);
  hum.high.frequency.setTargetAtTime(base * 2, t, 0.8);
  hum.high.detune.setTargetAtTime(unrest * 35, t, 0.8); // beating = unease
  hum.lfo.frequency.setTargetAtTime(0.15 + unrest * 4, t, 0.8);
  hum.lfoDepth.gain.setTargetAtTime(HUM_VOLUME * 0.6 * unrest, t, 0.8);
  hum.out.gain.setTargetAtTime(HUM_VOLUME, t, 0.5);
}

// ---------- alerts and UI ----------

/** Live alerts: critical = a short falling two-tone alarm, high = one falling tone, warning = a soft bell. */
export function playAlert(kind: 'critical' | 'high' | 'warning') {
  const r = ready();
  if (!r) return;
  const { audio, out } = r;
  if (kind === 'critical') {
    // A low falling alarm, twice, with a tritone in it.
    for (const at of [0, 0.36]) {
      tone(audio, out, { freq: 622, glideTo: 466, at, dur: 0.3, peak: 0.06, type: 'sawtooth', lowpass: 1600, space: 0.3 });
      tone(audio, out, { freq: 311, glideTo: 220, at, dur: 0.3, peak: 0.05, type: 'square', lowpass: 800, space: 0.3 });
    }
  } else if (kind === 'high') {
    tone(audio, out, { freq: 440, glideTo: 392, dur: 0.4, peak: 0.06, type: 'triangle', lowpass: 1400, space: 0.35 });
  } else {
    // Two bells a half step apart: unsettling rather than friendly.
    bell(audio, out, 329.63, 0, 1.1, 0.06, 0.45);
    bell(audio, out, 349.23, 0.14, 1.1, 0.045, 0.45);
  }
}

/** Sound switched on: a low hollow tone rising a minor third. */
export function playToggleOn() {
  const r = ready();
  if (!r) return;
  tone(r.audio, r.out, { freq: 220, glideTo: 261.63, dur: 0.45, peak: 0.08, type: 'sine', space: 0.45 });
  tone(r.audio, r.out, { freq: 110, dur: 0.5, peak: 0.05, type: 'triangle', lowpass: 600, space: 0.3 });
}

// ---------- stabilize ----------

/**
 * "Sealed": low bells up a D-minor chord over a deep drone. Relief, but in a dark world,
 * not a prize jingle.
 */
export function playStabilized() {
  const r = ready();
  if (!r) return;
  const { audio, out } = r;
  [146.83, 220, 293.66, 349.23].forEach((f, i) => bell(audio, out, f, i * 0.12, 2.2, 0.09, 0.55));
  tone(audio, out, { freq: 73.42, dur: 2.6, peak: 0.07, attack: 0.25, type: 'sine', space: 0.5 });
  tone(audio, out, { freq: 110, dur: 2.4, peak: 0.03, attack: 0.4, type: 'triangle', lowpass: 500, space: 0.7 });
}

/** Extra on a flawless win, on top of playStabilized: a faint, eerie A-minor shimmer high up. */
export function playFlawless() {
  const r = ready();
  if (!r) return;
  const { audio, out } = r;
  [880, 1046.5, 1318.5].forEach((f, i) => bell(audio, out, f, 0.5 + i * 0.09, 1.6, 0.025, 0.75));
}

/** The frequency game locks on: a low, soft glide up a fourth. */
export function playInTune() {
  const r = ready();
  if (!r) return;
  tone(r.audio, r.out, { freq: 293.66, glideTo: 392, dur: 0.4, peak: 0.05, type: 'sine', space: 0.45 });
}

// ---------- the Desync ----------

/**
 * The Desync strikes back: a heavy, distorted hit. Filtered noise sweeping down over detuned saws
 * dropping an octave and a half, with a sub drop underneath and a reverb tail. About 1 s.
 */
export function playStinger() {
  const r = ready();
  if (!r) return;
  const { audio, out } = r;
  noise(audio, out, { dur: 0.9, peak: 0.14, filter: 'lowpass', from: 4500, to: 120, space: 0.5 });
  for (const detune of [-25, 25]) {
    tone(audio, out, { freq: 110, glideTo: 38, dur: 0.9, peak: 0.07, type: 'sawtooth', detune, lowpass: 900, space: 0.4 });
  }
  tone(audio, out, { freq: 60, glideTo: 28, dur: 1.1, peak: 0.16, type: 'sine' });
}

/** The Desync level changed: an ominous low swell when it rises, a soft rising chord when it falls. */
export function playLevelShift(worse: boolean) {
  const r = ready();
  if (!r) return;
  const { audio, out } = r;
  if (worse) {
    tone(audio, out, { freq: 55, glideTo: 49, dur: 1.4, peak: 0.08, attack: 0.35, type: 'sawtooth', lowpass: 500, space: 0.6 });
    tone(audio, out, { freq: 82.4, glideTo: 73.4, dur: 1.4, peak: 0.05, attack: 0.35, type: 'sawtooth', lowpass: 500, space: 0.6 });
    noise(audio, out, { dur: 1.2, peak: 0.03, filter: 'bandpass', from: 300, to: 1200, space: 0.6 });
  } else {
    // Receding: a soft A-minor chord, relief without cheer.
    [220, 261.63, 329.63].forEach((f, i) =>
      tone(audio, out, { freq: f, at: i * 0.09, dur: 1.4, peak: 0.035, attack: 0.12, type: 'triangle', lowpass: 1200, space: 0.6 }),
    );
  }
}

// ---------- game feedback ----------

/**
 * One note per rune, from an eerie scale (A, B flat, C sharp, E, F: the "Hijaz" sound), low.
 * Every sequence sounds like an incantation, not a nursery tune.
 */
const RUNE_NOTES = [220, 233.08, 277.18, 329.63, 349.23];

/** A rune lights up or is pressed: a bell / marimba hit on its own note. */
export function playRuneTone(rune: number, durationMs = 420) {
  const r = ready();
  if (!r) return;
  bell(r.audio, r.out, RUNE_NOTES[rune % RUNE_NOTES.length], 0, Math.max(0.7, durationMs / 1000 + 0.5), 0.1, 0.5);
}

/** A wrong rune: a short dissonant buzz. */
export function playRuneError() {
  const r = ready();
  if (!r) return;
  const { audio, out } = r;
  for (const freq of [110, 116.5]) {
    tone(audio, out, { freq, glideTo: freq * 0.7, dur: 0.3, peak: 0.06, type: 'square', lowpass: 900, space: 0.15 });
  }
}

/** Chrono-Pulse hit: a crisp click plus a tone that climbs with the combo; "great" rings brighter. */
export function playPulseHit(great: boolean, combo: number) {
  const r = ready();
  if (!r) return;
  const { audio, out } = r;
  noise(audio, out, { dur: 0.03, peak: 0.07, filter: 'bandpass', from: 1800 });
  const base = 293.66 * Math.pow(2, ((Math.max(1, combo) - 1) * 3) / 12); // a minor third up per combo step
  if (great) bell(audio, out, base * 1.5, 0, 1.0, 0.08, 0.5);
  else tone(audio, out, { freq: base, dur: 0.3, peak: 0.07, type: 'triangle', lowpass: 1400, space: 0.35 });
}

/** Chrono-Pulse miss: a dull thud. */
export function playPulseMiss() {
  const r = ready();
  if (!r) return;
  const { audio, out } = r;
  tone(audio, out, { freq: 150, glideTo: 55, dur: 0.25, peak: 0.12, type: 'sine' });
  noise(audio, out, { dur: 0.12, peak: 0.05, filter: 'lowpass', from: 500 });
}

/** The last seconds of the game timer: a woodblock tick (higher when it's urgent). */
export function playTimerTick(urgent: boolean) {
  const r = ready();
  if (!r) return;
  const { audio, out } = r;
  // A clockwork tick with a low knock under it; the knock gets heavier when it's urgent.
  tone(audio, out, { freq: urgent ? 900 : 700, dur: 0.04, peak: 0.04, type: 'sine' });
  tone(audio, out, { freq: urgent ? 90 : 120, dur: 0.12, peak: urgent ? 0.1 : 0.06, type: 'sine' });
  noise(audio, out, { dur: 0.02, peak: 0.03, filter: 'bandpass', from: 1400 });
}

// ---------- mini-game music ----------

/**
 * Generated tension music under a mini-game: a dark loop in D minor,
 * D minor > B flat > G minor > A7 (the C sharp in A7 pulls back to D: "time is running out").
 * Pulsing bass, a quiet arpeggio, a soft kick on 1 and 3, ticking hats.
 * `setGameMusicIntensity` (0-1, the timer) speeds it up and opens it up toward the end.
 * Notes are scheduled a little ahead on the audio clock, so the timing never jitters.
 */
const BARS: { bass: number; arp: number[] }[] = [
  { bass: 73.42, arp: [293.66, 349.23, 440, 523.25] }, // D minor 7
  { bass: 58.27 * 2, arp: [233.08, 293.66, 349.23, 440] }, // B flat major 7
  { bass: 98, arp: [196, 233.08, 293.66, 349.23] }, // G minor 7
  { bass: 110, arp: [220, 277.18, 329.63, 392] }, // A7
];
/** Arpeggio contour over eight 16ths: up and back down. */
const ARP_ORDER = [0, 1, 2, 3, 2, 1, 0, 1];

type Music = { timer: ReturnType<typeof setInterval>; fader: GainNode; nextTime: number; step: number };
let music: Music | null = null;
let intensity = 0;

export function setGameMusicIntensity(value: number) {
  intensity = Math.max(0, Math.min(1, value));
}

function musicStep(audio: AudioContext, out: Bus, m: Music, time: number) {
  const at = Math.max(0, time - audio.currentTime);
  const s = m.step % 16;
  const bar = BARS[Math.floor(m.step / 16) % BARS.length];
  const dest = m.fader;
  const stepDur = 60 / (92 + intensity * 38) / 4;

  // Bass: 8th notes, accent on the downbeat; the filter opens as time runs out.
  if (s % 2 === 0) {
    tone(audio, out, {
      freq: bar.bass, at, dur: stepDur * 1.8, peak: s === 0 ? 0.09 : 0.06,
      type: 'sawtooth', lowpass: 260 + intensity * 600, dest,
    });
  }
  // Arpeggio: 16ths, quiet, with a bit of space.
  tone(audio, out, {
    freq: bar.arp[ARP_ORDER[s % 8]], at, dur: stepDur * 1.6, peak: 0.022 + intensity * 0.012,
    type: 'triangle', lowpass: 1500 + intensity * 1500, space: 0.3, dest,
  });
  // Kick on 1 and 3.
  if (s === 0 || s === 8) tone(audio, out, { freq: 90, glideTo: 40, at, dur: 0.22, peak: 0.12, type: 'sine', dest });
  // Hats: offbeat 8ths, every 16th when it gets tight.
  if (s % 2 === 1 || intensity > 0.7) {
    noise(audio, out, { at, dur: 0.03, peak: s % 2 === 1 ? 0.014 : 0.008, filter: 'highpass', from: 7000, dest });
  }
  // In the last stretch: a high, dissonant ping on the "and" of 4, like a warning light.
  if (intensity > 0.75 && s === 14) {
    tone(audio, out, { freq: 1108.73, at, dur: 0.18, peak: 0.02, type: 'sine', space: 0.4, dest });
  }
}

/** Start the mini-game music (no-op if it is already playing or sound is off). */
export function startGameMusic() {
  if (music) return;
  const r = ready();
  if (!r) return;
  const { audio, out } = r;
  const fader = audio.createGain();
  fader.gain.setValueAtTime(0.0001, audio.currentTime);
  fader.gain.exponentialRampToValueAtTime(0.8, audio.currentTime + 0.8);
  fader.connect(out.input);
  intensity = 0;

  const m: Music = { timer: 0 as unknown as ReturnType<typeof setInterval>, fader, nextTime: audio.currentTime + 0.1, step: 0 };
  m.timer = setInterval(() => {
    if (!isSoundOn()) return stopGameMusic(); // muted mid-game
    // Schedule every step that starts in the next 120 ms.
    while (m.nextTime < audio.currentTime + 0.12) {
      musicStep(audio, out, m, m.nextTime);
      m.nextTime += 60 / (92 + intensity * 38) / 4;
      m.step++;
    }
  }, 25);
  music = m;
}

/** Fade the music out (win, fail, or leaving the game). */
export function stopGameMusic() {
  const m = music;
  if (!m || !ctx) return;
  music = null;
  clearInterval(m.timer);
  m.fader.gain.cancelScheduledValues(ctx.currentTime);
  m.fader.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
  setTimeout(() => m.fader.disconnect(), 1200);
}

/** Whether the mini-game music is running (and at which step), for debugging. */
export function gameMusicState() {
  return music ? { playing: true, step: music.step, intensity } : { playing: false, step: 0, intensity };
}
