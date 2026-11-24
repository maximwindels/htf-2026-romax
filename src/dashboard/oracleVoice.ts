/**
 * The Oracle's voice in the browser.
 * - Gemini speech (deep voice + wizard style) is played through Web Audio with a wizard effect:
 *   a little slower and lower, a bass boost, and the echo of a stone tower (generated reverb).
 * - Without Gemini speech, the browser's own voice is used: as low and slow as it goes.
 * - Mute is remembered per browser, so the wizard stays quiet during a presentation.
 */
import { useSyncExternalStore } from "react";
import { speakOracle } from "#/lib/ai.functions.ts";

type VoiceState = {
  muted: boolean;
  speakingId: string | null;
  loadingId: string | null;
};

const MUTE_KEY = "oracle-voice-muted";
let state: VoiceState = { muted: false, speakingId: null, loadingId: null };
try {
  state.muted =
    typeof localStorage !== "undefined" &&
    localStorage.getItem(MUTE_KEY) === "1";
} catch {
  // storage blocked: start unmuted
}

const listeners = new Set<() => void>();
function set(next: Partial<VoiceState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function useOracleVoice(): VoiceState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => ({ muted: false, speakingId: null, loadingId: null }),
  );
}

export function toggleOracleMute() {
  const muted = !state.muted;
  if (muted) stopOracleVoice();
  set({ muted });
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // not remembered, still muted for now
  }
}

// ---------- playback ----------

let ctx: AudioContext | null = null;
let current: AudioBufferSourceNode | null = null;
/** Bumped on every speak/stop, so an answer that arrives late doesn't start after Stop. */
let token = 0;
/** Decoded audio per message, so Speak twice doesn't fetch twice. */
const buffers = new Map<string, AudioBuffer>();

export function stopOracleVoice() {
  token++;
  try {
    current?.stop();
  } catch {
    // already stopped
  }
  current = null;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  set({ speakingId: null, loadingId: null });
}

/** Speak one answer. `id` identifies the message (to show Stop on the right one). */
export async function speakOracleAnswer(id: string, text: string) {
  if (state.muted) return;
  stopOracleVoice();
  const mine = ++token;
  set({ loadingId: id });

  ctx ??= new AudioContext();
  if (ctx.state === "suspended") await ctx.resume();

  let buffer = buffers.get(id);
  if (!buffer) {
    try {
      const result = await speakOracle({ data: text });
      if (result) {
        const bytes = Uint8Array.from(atob(result.audio), (c) =>
          c.charCodeAt(0),
        );
        buffer = await ctx.decodeAudioData(bytes.buffer);
        buffers.set(id, buffer);
      }
    } catch {
      // fall back to the browser voice below
    }
  }
  if (mine !== token || state.muted) return;

  if (buffer) playWithWizardEffect(ctx, buffer, id, mine);
  else speakWithBrowserVoice(text, id, mine);
}

/** Slightly slower and lower, bass boost, and a stone-tower echo. No AI involved, just audio nodes. */
function playWithWizardEffect(
  audio: AudioContext,
  buffer: AudioBuffer,
  id: string,
  mine: number,
) {
  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = 0.92; // ~1.5 semitones lower and a touch slower

  const bass = audio.createBiquadFilter();
  bass.type = "lowshelf";
  bass.frequency.value = 220;
  bass.gain.value = 5;

  const dry = audio.createGain();
  dry.gain.value = 0.9;
  const wet = audio.createGain();
  wet.gain.value = 0.32;
  const reverb = audio.createConvolver();
  reverb.buffer = towerEcho(audio);

  source.connect(bass);
  bass.connect(dry).connect(audio.destination);
  bass.connect(reverb).connect(wet).connect(audio.destination);

  source.onended = () => {
    if (mine === token) set({ speakingId: null });
  };
  current = source;
  set({ loadingId: null, speakingId: id });
  source.start();
}

/** A generated reverb: 2.6 s of fading noise, like the inside of a stone tower. */
let echo: AudioBuffer | null = null;
function towerEcho(audio: AudioContext) {
  if (echo) return echo;
  const seconds = 2.6;
  const length = Math.floor(audio.sampleRate * seconds);
  echo = audio.createBuffer(2, length, audio.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = echo.getChannelData(channel);
    for (let i = 0; i < length; i++)
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
  }
  return echo;
}

/** Fallback: the browser's built-in voice, as low and slow as it goes. */
function speakWithBrowserVoice(text: string, id: string, mine: number) {
  if (typeof speechSynthesis === "undefined") {
    set({ loadingId: null });
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text.replace(/[•*#_`]/g, ""));
  const voices = speechSynthesis.getVoices();
  // Prefer a deep British male voice; any English voice otherwise.
  utterance.voice =
    voices.find((v) =>
      /george|daniel|uk english male|ryan|guy/i.test(v.name),
    ) ??
    voices.find((v) => /^en/i.test(v.lang) && /male/i.test(v.name)) ??
    voices.find((v) => /^en/i.test(v.lang)) ??
    null;
  utterance.pitch = 0.35;
  utterance.rate = 0.82;
  utterance.onend = () => {
    if (mine === token) set({ speakingId: null });
  };
  set({ loadingId: null, speakingId: id });
  speechSynthesis.speak(utterance);
}
