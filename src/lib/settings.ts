/** Persisted settings: the backend proxy URL and the user's preferences. */

import type { SourceId } from '../sources/types'
import type { Notation } from './chords'

const BACKEND_KEY = 'gc.backendUrl.v1'
const PREFS_KEY = 'gc.prefs.v1'

/**
 * Default backend proxy (a Cloudflare Worker) so the live app works out of
 * the box. It can be changed or cleared in Ajustes; an empty string there
 * is remembered and disables the default.
 */
export const DEFAULT_BACKEND = 'https://acordes.fabianignaciomv.workers.dev'

/**
 * Optional user-deployed proxy backend (see worker/README.md). It must
 * accept `?url=<encoded target>` and return the raw body with
 * `Access-Control-Allow-Origin: *`.
 */
export function getBackendUrl(): string {
  try {
    const stored = localStorage.getItem(BACKEND_KEY)
    // Never set -> use the default. Explicitly cleared ('') -> disabled.
    if (stored === null) return DEFAULT_BACKEND
    return stored.trim().replace(/\/+$/, '')
  } catch {
    return DEFAULT_BACKEND
  }
}

export function setBackendUrl(url: string): void {
  try {
    localStorage.setItem(BACKEND_KEY, url.trim())
  } catch {
    /* ignore */
  }
}

/* ---- Preferences ---- */

export type Theme = 'auto' | 'dark' | 'light'

export interface Prefs {
  theme: Theme
  /** Chord names as C D E… or Do Re Mi… */
  notation: Notation
  /** Wrap long lines keeping chords over their syllable (vs. original layout). */
  wrap: boolean
  showDiagrams: boolean
  /** Keep the screen on while a song is open. */
  keepAwake: boolean
  fontSize: number
  /** Sources used for searching. */
  sources: SourceId[]
}

export const FONT_MIN = 12
export const FONT_MAX = 30

const DEFAULTS: Prefs = {
  theme: 'auto',
  notation: 'english',
  wrap: true,
  showDiagrams: true,
  keepAwake: true,
  fontSize: 17,
  sources: ['cifraclub', 'ultimate-guitar', 'lacuerda', 'tusacordes'],
}

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null') as Partial<Prefs> | null
    const prefs = { ...DEFAULTS, ...(raw ?? {}) }
    if (!raw) {
      // Migrate the font size remembered by older versions.
      const legacy = Number(localStorage.getItem('gc.fontSize.v1'))
      if (legacy >= FONT_MIN && legacy <= FONT_MAX) prefs.fontSize = legacy
    }
    if (!Array.isArray(prefs.sources) || prefs.sources.length === 0) prefs.sources = DEFAULTS.sources
    return prefs
  } catch {
    return { ...DEFAULTS }
  }
}

let prefs: Prefs = load()
const listeners = new Set<() => void>()

export function getPrefs(): Prefs {
  return prefs
}

export function setPrefs(patch: Partial<Prefs>): void {
  prefs = { ...prefs, ...patch }
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export function subscribePrefs(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
