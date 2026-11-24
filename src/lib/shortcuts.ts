import { useSyncExternalStore } from 'react'

/** Every shortcut, for the help dialog. `keys` are shown as separate keycaps. */
export const SHORTCUTS: { group: string; items: { keys: string[]; label: string; commanderOnly?: boolean }[] }[] = [
  {
    group: 'Anywhere',
    items: [
      { keys: ['?'], label: 'Show these shortcuts' },
      { keys: ['T'], label: 'Toggle light / dark mode' },
      { keys: ['N'], label: 'Report a new echo' },
      { keys: ['G', 'O'], label: 'Go to overview' },
      { keys: ['G', 'A'], label: 'Go to anomalies' },
      { keys: ['G', 'G'], label: 'Go to guardians', commanderOnly: true },
    ],
  },
  {
    group: 'Glitch list',
    items: [
      { keys: ['J'], label: 'Next glitch' },
      { keys: ['K'], label: 'Previous glitch' },
      { keys: ['Enter'], label: 'Open selected glitch' },
    ],
  },
  {
    group: 'Glitch page',
    items: [
      { keys: ['J'], label: 'Next (older) glitch' },
      { keys: ['K'], label: 'Previous (newer) glitch' },
      { keys: ['U'], label: 'Back to overview' },
      { keys: ['S'], label: 'Jump to the stabilizer' },
    ],
  },
]

// Tiny store for "is the help dialog open", so the top bar button and the `?` key share it.
let helpOpen = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function openShortcutsHelp() {
  helpOpen = true
  emit()
}
export function closeShortcutsHelp() {
  helpOpen = false
  emit()
}
export function useShortcutsHelpOpen() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => helpOpen,
    () => false,
  )
}

/** True when a key press belongs to a text field rather than to the app. */
export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  // Sliders and checkboxes don't take letters, so shortcuts still work while they have focus.
  return target instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button'].includes(target.type)
}
