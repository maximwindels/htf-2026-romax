import { useSyncExternalStore } from 'react'

/**
 * Light/dark theme. The theme lives on <html data-theme="…">, so CSS (styles.css, grid.css)
 * and Tailwind's `dark:` variant both follow it. Dark ("Curse of Achrona") is the default.
 */
export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'htf-theme'
const EVENT = 'htf-theme-change'

/**
 * Runs inline in <head> before the page paints, so a light-mode user never sees a dark flash.
 * Keep it tiny and dependency-free: it is injected as a plain string.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){}})()`

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
