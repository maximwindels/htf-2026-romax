import { useEffect, useRef, useState } from 'react';
import { useSoundOn } from '#/dashboard/alerts';
import { DESYNC_LEVELS, setDesyncLevel, type DesyncState } from '#/dashboard/desync';
import { playStabilized, setHum } from '#/dashboard/sound';

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

  if (!banner) return null;
  return (
    <div key={banner.key} className={`desync-banner ${banner.worse ? 'is-worse' : 'is-better'}`} role="status">
      {banner.text}
    </div>
  );
}
