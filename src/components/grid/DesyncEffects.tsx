import { useEffect, useRef, useState } from 'react';
import { useSoundOn } from '#/dashboard/alerts';
import { DESYNC_LEVELS, setDesyncLevel, type DesyncState } from '#/dashboard/desync';
import { playStabilized, playStinger, setHum } from '#/dashboard/sound';

/**
 * Applies The Desync to the whole app: sets <html data-desync="0-3"> for the CSS corruption,
 * keeps the ambient hum in tune with the magic, and flashes a banner when the level changes.
 */
export function DesyncEffects({ state }: { state: DesyncState }) {
  const { level, magic } = state;
  const soundOn = useSoundOn();
  const previous = useRef(level);
  const mountedAt = useRef(typeof performance === 'undefined' ? 0 : performance.now());
  const [banner, setBanner] = useState<{ key: number; text: string; worse: boolean } | null>(null);

  useEffect(() => {
    document.documentElement.dataset.desync = String(level);
    setDesyncLevel(level);

    const before = previous.current;
    previous.current = level;
    // No banner for the jump when the alerts first load after opening the page.
    if (level === before || performance.now() - mountedAt.current < 4000) return;
    const worse = level > before;
    setBanner({
      key: Date.now(),
      worse,
      text: worse
        ? `The Desync grows · level ${level}: ${DESYNC_LEVELS[level].name}`
        : level === 0
          ? 'Grid stabilized · all clear'
          : `The Desync recedes · level ${level}: ${DESYNC_LEVELS[level].name}`,
    });
    if (level === 0) playStabilized();
    const timer = setTimeout(() => setBanner(null), 2600);
    return () => clearTimeout(timer);
  }, [level]);

  // Mini-game results, seen by everyone: a fail makes the Desync strike back, a flawless win
  // makes the grid more immune. Only changes after the page has loaded count (not the first fetch).
  const prevBacklash = useRef(state.backlashCount);
  const prevMultiplier = useRef(state.multiplier);
  useEffect(() => {
    const struck = state.backlashCount > prevBacklash.current;
    const immune = state.multiplier < prevMultiplier.current;
    prevBacklash.current = state.backlashCount;
    prevMultiplier.current = state.multiplier;
    if (performance.now() - mountedAt.current < 4000 || (!struck && !immune)) return;
    if (struck) playStinger();
    setBanner({
      key: Date.now(),
      worse: struck,
      text: struck
        ? 'The Desync strikes back · corruption +15 %'
        : `Aether Charge · the grid is now ${Math.round((1 - state.multiplier) * 100)} % immune`,
    });
    const timer = setTimeout(() => setBanner(null), 2600);
    return () => clearTimeout(timer);
  }, [state.backlashCount, state.multiplier]);

  // Clean up when leaving the app (e.g. logging out to the login page).
  useEffect(
    () => () => {
      delete document.documentElement.dataset.desync;
      setDesyncLevel(0);
      setHum(null);
    },
    [],
  );

  useEffect(() => {
    setHum(soundOn ? magic : null);
  }, [soundOn, magic]);

  // Damage that follows the magic left: <html data-magic="whole|cracked|shattered|broken">,
  // plus --magic-loss (0..1) for effects that scale smoothly. All of it is styled in grid.css.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.magic = magicTier(magic);
    root.style.setProperty('--magic-loss', String((100 - magic) / 100));
  }, [magic]);
  useEffect(
    () => () => {
      delete document.documentElement.dataset.magic;
      document.documentElement.style.removeProperty('--magic-loss');
    },
    [],
  );

  return (
    <>
      <CrackOverlay />
      {banner && (
        <div key={banner.key} className={`desync-banner ${banner.worse ? 'is-worse' : 'is-better'}`} role="status">
          {banner.text}
        </div>
      )}
    </>
  );
}

/** ≤ 77 % cracked, ≤ 33 % shattered, 0 % broken. */
export function magicTier(magic: number) {
  if (magic <= 0) return 'broken';
  if (magic <= 33) return 'shattered';
  if (magic <= 77) return 'cracked';
  return 'whole';
}

// ---------- crack drawings (shown and animated by grid.css per tier) ----------

/** Cracks spreading from a corner (drawn for the top-left; other corners are mirrored in CSS). */
const CORNER_MAIN = 'M0 0L60 38L95 41L140 88L190 101L232 150L300 168L340 220L400 236';
const CORNER_BRANCHES = [
  'M60 38L72 90L110 128L118 190L160 232',
  'M95 41L150 30L210 46L260 30L330 52',
  'M140 88L170 140L150 180',
  'M190 101L230 92L270 118',
  'M110 128L70 160L60 220L20 260',
  'M232 150L240 210L280 250',
  'M160 232L150 290L180 330',
].join('');

/** One crack: a dark offset edge underneath, the red crack, and a bright core on the main line. */
function Crack({ main, branches }: { main: string; branches: string }) {
  return (
    <>
      <path className="crack-edge" d={main + branches} pathLength={1} transform="translate(2 2)" />
      <path className="crack-line" d={main + branches} pathLength={1} />
      <path className="crack-core" d={main} pathLength={1} />
    </>
  );
}

function CrackOverlay() {
  return (
    <div className="desync-cracks" aria-hidden>
      <div className="desync-vignette" />
      {(['tl', 'tr', 'br', 'bl'] as const).map((corner) => (
        <svg key={corner} className={`crack crack-${corner}`} viewBox="0 0 400 400">
          <Crack main={CORNER_MAIN} branches={CORNER_BRANCHES} />
        </svg>
      ))}
    </div>
  );
}
