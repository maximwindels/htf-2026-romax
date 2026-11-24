import { useSyncExternalStore } from 'react'

/**
 * Light/dark theme. The theme lives on <html data-theme="…">, so CSS (styles.css, grid.css)
 * and Tailwind's `dark:` variant both follow it. Dark ("Curse of Achrona") is the default.
 */
export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'htf-theme'
const PRESENT_KEY = 'htf-present'
const EVENT = 'htf-theme-change'

/**
 * Runs inline in <head> before the page paints, so a light-mode user never sees a dark flash
 * (and a presenter never sees the page jump to presentation size). Keep it tiny and
 * dependency-free: it is injected as a plain string.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,t=localStorage.getItem('${STORAGE_KEY}');d.dataset.theme=t==='light'?'light':'dark';if(localStorage.getItem('${PRESENT_KEY}')==='on')d.dataset.present='on'}catch(e){}})()`

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* private mode: theme just isn't remembered */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function toggleTheme() {
  setTheme(readTheme() === 'dark' ? 'light' : 'dark')
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}

export function useTheme(): Theme {
  // Server render always assumes dark; the boot script may already have switched the page.
  return useSyncExternalStore(subscribe, readTheme, () => 'dark')
}

// ---------- presentation mode ----------

/**
 * For a projector or a big screen: everything larger, more contrast, no grain or scanlines.
 * Lives on <html data-present="on">; styled at the bottom of styles.css.
 */
function readPresent(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.present === 'on'
}

export function setPresent(on: boolean) {
  const root = document.documentElement
  if (on) root.dataset.present = 'on'
  else delete root.dataset.present
  try {
    localStorage.setItem(PRESENT_KEY, on ? 'on' : 'off')
  } catch {
    /* not remembered in private mode */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function togglePresent() {
  setPresent(!readPresent())
}

export function usePresent(): boolean {
  return useSyncExternalStore(subscribe, readPresent, () => false)
}
