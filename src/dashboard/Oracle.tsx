import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { LoaderCircle, Send, X } from "lucide-react";
import { PixelIcon } from "#/components/grid/PixelIcon";
import { askAssistant, getAiStatus } from "#/lib/ai.functions.ts";

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
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(question);
  };

  if (!isOpen) return null;

  return (
    <aside className="oracle grid-ui" role="dialog" aria-label="Ask the Oracle">
      <header className="oracle-head">
        <PixelIcon name="crystal" size={27} />
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
            <p>
              Ask about active incidents, alerts, nodes or forecasts. Every
              answer uses the live grid.
            </p>
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
        {turns.map((t, i) => (
          <div key={i} className={`oracle-msg role-${t.role}`}>
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
          </div>
        ))}
        {busy && (
          <div className="oracle-msg role-assistant">
            <LoaderCircle className="size-4 animate-spin" /> Gazing into the
            grid…
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
  );
}
