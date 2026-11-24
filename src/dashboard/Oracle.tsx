import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { LoaderCircle, Send, Square, Volume2, VolumeX, X } from "lucide-react";
import { WizardMascot } from "#/components/grid/WizardMascot";
import { askAssistant, getAiStatus } from "#/lib/ai.functions.ts";
import { speakOracleAnswer, stopOracleVoice, toggleOracleMute, useOracleVoice } from "./oracleVoice";

// Tiny store for "is the Oracle open", shared by the top-bar button, the O key and the panel.
let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export function toggleOracle() {
  open = !open;
  emit();
}
export function useOracleOpen() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
    () => false,
  );
}

type Turn = { role: "user" | "assistant"; text: string; source?: string };

const STARTERS = [
  "What needs my attention right now?",
  "Which node is in the worst shape?",
  "Summarize the open glitches",
  "Is a Desync wave coming?",
];

/**
 * The Oracle: a chat panel that answers operators' questions about active incidents and alerts.
 * Every question is sent with a live snapshot of the grid (server side), so answers use current data.
 */
export function OraclePanel() {
  const isOpen = useOracleOpen();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  /** The wizard hops for a moment when an answer arrives. */
  const [speaking, setSpeaking] = useState(false);
  const voice = useOracleVoice();
  const mood = busy ? "thinking" : speaking || voice.speakingId ? "speaking" : "idle";
  const [status, setStatus] = useState<{
    enabled: boolean;
    model: string;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
    if (!status)
      getAiStatus()
        .then(setStatus)
        .catch(() => setStatus(null));
  }, [isOpen, status]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [turns, busy]);

  // Closing the panel silences the wizard.
  useEffect(() => {
    if (!isOpen) stopOracleVoice();
  }, [isOpen]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history = turns.map(({ role, text }) => ({ role, text }));
    setTurns((t) => [...t, { role: "user", text: q }]);
    setQuestion("");
    setBusy(true);
    try {
      const { answer, source } = await askAssistant({
        data: { question: q, history },
      });
      setTurns((t) => [...t, { role: "assistant", text: answer, source }]);
    } catch (err) {
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          text:
            err instanceof Error ? err.message : "The Oracle could not answer.",
          source: "error",
        },
      ]);
    } finally {
      setBusy(false);
      setSpeaking(true);
      setTimeout(() => setSpeaking(false), 600);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(question);
  };

  return (
    <>
      {/* The wizard in the bottom-right corner opens and closes the Oracle (also the O key). */}
      <button
        type="button"
        className={`oracle-fab ${isOpen ? "is-open" : ""}`}
        onClick={toggleOracle}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close the Oracle" : "Ask the Oracle"}
      >
        <WizardMascot size={52} mood={mood} />
        <span className="oracle-fab-label" aria-hidden>
          {isOpen ? "Close" : "Ask the Oracle"} <kbd className="kbd">O</kbd>
        </span>
      </button>
      {isOpen && (
    <aside className="oracle grid-ui" role="dialog" aria-label="Ask the Oracle">
      <header className="oracle-head">
        <WizardMascot size={40} mood={mood} />
        <div>
          <div className="oracle-title">The Oracle</div>
          <div className="oracle-sub">
            {status
              ? status.enabled
                ? status.model
                : "Offline: live summary only"
              : "…"}
          </div>
        </div>
        <button
          type="button"
          className={`btn-small ghost oracle-mute ${voice.muted ? "is-muted" : ""}`}
          onClick={toggleOracleMute}
          aria-pressed={voice.muted}
          title={voice.muted ? "The wizard is muted: click to let him speak" : "Mute the wizard's voice"}
          aria-label={voice.muted ? "Unmute the wizard" : "Mute the wizard"}
        >
          {voice.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <button
          type="button"
          className="btn-small ghost oracle-close"
          onClick={toggleOracle}
          aria-label="Close the Oracle"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="oracle-list" ref={listRef}>
        {turns.length === 0 && (
          <div className="oracle-empty">
            <div className="oracle-welcome">
              <WizardMascot size={88} mood={mood} />
              <p className="oracle-bubble">
                Greetings, guardian. Ask me about incidents, alerts, nodes or
                what the forecasts foretell. I read the live grid for every
                answer.
              </p>
            </div>
            <div className="oracle-starters">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="oracle-starter"
                  onClick={() => void ask(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => {
          const message = (
            <div className={`oracle-msg role-${t.role}`}>
              {t.role === "assistant" && t.source && (
                <span className={`ai-tag source-${t.source}`}>
                  {t.source === "ai"
                    ? "AI"
                    : t.source === "rules"
                      ? "Rules"
                      : "!"}
                </span>
              )}
              <p>{t.text}</p>
              {t.role === "assistant" && t.source !== "error" && !voice.muted && (
                <SpeakButton id={`turn-${i}`} text={t.text} voice={voice} />
              )}
            </div>
          );
          if (t.role === "user") return <div key={i} className="oracle-row role-user">{message}</div>;
          // The wizard speaks the answers; the newest one hops when it arrives.
          const latest = i === turns.length - 1;
          return (
            <div key={i} className="oracle-row role-assistant">
              <WizardMascot size={28} mood={latest ? mood : "idle"} />
              {message}
            </div>
          );
        })}
        {busy && (
          <div className="oracle-row role-assistant">
            <WizardMascot size={28} mood="thinking" />
            <div className="oracle-msg role-assistant">
              <span className="inline-flex items-center gap-2">
                <LoaderCircle className="size-4 animate-spin" /> Gazing into the
                grid…
              </span>
            </div>
          </div>
        )}
      </div>

      <form className="oracle-form" onSubmit={onSubmit}>
        <textarea
          ref={inputRef}
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask(question);
            }
            if (e.key === "Escape") toggleOracle();
          }}
          placeholder="Ask the Oracle…"
          aria-label="Question for the Oracle"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          aria-label="Ask"
        >
          <Send className="size-4" />
        </button>
      </form>
    </aside>
      )}
    </>
  );
}

/** "Speak" under an answer; "Stop" while that answer is being spoken. */
function SpeakButton({ id, text, voice }: { id: string; text: string; voice: ReturnType<typeof useOracleVoice> }) {
  const speaking = voice.speakingId === id;
  const loading = voice.loadingId === id;
  return (
    <button
      type="button"
      className={`oracle-speak ${speaking ? "is-speaking" : ""}`}
      onClick={() => (speaking || loading ? stopOracleVoice() : void speakOracleAnswer(id, text))}
      title={speaking ? "Stop the wizard" : "Let the wizard say it out loud"}
    >
      {loading ? (
        <LoaderCircle className="size-3.5 animate-spin" />
      ) : speaking ? (
        <Square className="size-3.5" />
      ) : (
        <Volume2 className="size-3.5" />
      )}
      {loading ? "Summoning voice…" : speaking ? "Stop" : "Speak"}
    </button>
  );
}
