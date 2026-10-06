import type { Line, SongDetail, SongSummary } from '../sources/types'
import { deserializeLines, serializeLines } from './chords'

/**
 * Local persistence (localStorage). Songs are stored compactly: the sheet
 * as one marked string instead of token JSON (~5x smaller), so many more
 * favorites fit in the ~5 MB quota. Entries written by older versions
 * (with `lines`) are still read.
 */

const FAV_KEY = 'gc.favorites.v1'
const RECENT_KEY = 'gc.recents.v1'
const CACHE_KEY = 'gc.songCache.v1'
const SONG_PREFS_KEY = 'gc.songPrefs.v1'
const LEGACY_TRANSPOSE_KEY = 'gc.transpose.v1'
const HISTORY_KEY = 'gc.searchHistory.v1'
const SCROLL_SPEED_KEY = 'gc.scrollSpeed.v1'

export const SCROLL_SPEED_MIN = 0.3
export const SCROLL_SPEED_MAX = 10
const SCROLL_SPEED_DEFAULT = 2.5

type Stored = Omit<SongDetail, 'lines'> & { lines?: Line[]; sheet?: string }

/** A favorite stores the full parsed sheet so it works offline. */
export interface Favorite extends SongDetail {
  savedAt: number
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    notify()
    return true
  } catch {
    return false // storage full or disabled
  }
}

/* ---- change notifications (so lists refresh everywhere) ---- */

const listeners = new Set<() => void>()
let version = 0
function notify() {
  version++
  listeners.forEach((l) => l())
}
export function subscribeStorage(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export function storageVersion(): number {
  return version
}

/* ---- compact song encoding ---- */

function pack(song: SongDetail): Stored {
  const { lines, ...rest } = song
  return { ...rest, sheet: serializeLines(lines) }
}

function unpack<T extends Stored>(s: T): T & { lines: Line[] } {
  const { sheet, ...rest } = s
  const lines = s.lines ?? (sheet != null ? deserializeLines(sheet) : [])
  // Older favorites stored capo as text ("2ª casa", "traste 2").
  let capoFret = s.capoFret
  if (capoFret == null && s.capo) capoFret = Number(s.capo.match(/\d+/)?.[0] ?? 0) || 0
  return { ...(rest as T), lines, capoFret }
}

/* ---- favorites ---- */

export function getFavorites(): Favorite[] {
  return read<Array<Stored & { savedAt: number }>>(FAV_KEY, [])
    .map((f) => unpack(f) as Favorite)
    .sort((a, b) => b.savedAt - a.savedAt)
}

export function isFavorite(id: string): boolean {
  return read<Stored[]>(FAV_KEY, []).some((f) => f.id === id)
}

export function getFavorite(id: string): Favorite | null {
  const f = read<Array<Stored & { savedAt: number }>>(FAV_KEY, []).find((x) => x.id === id)
  return f ? (unpack(f) as Favorite) : null
}

/** Returns the new state (true = now a favorite), or null if storage is full. */
export function toggleFavorite(song: SongDetail): boolean | null {
  const favs = read<Array<Stored & { savedAt: number }>>(FAV_KEY, [])
  const idx = favs.findIndex((f) => f.id === song.id)
  if (idx >= 0) {
    favs.splice(idx, 1)
    write(FAV_KEY, favs)
    return false
  }
  favs.push({ ...pack(song), savedAt: Date.now() })
  return write(FAV_KEY, favs) ? true : null
}

export function removeFavorite(id: string): void {
  write(
    FAV_KEY,
    read<Stored[]>(FAV_KEY, []).filter((f) => f.id !== id)
  )
}

/** Put back a favorite (undo after delete). */
export function restoreFavorite(fav: Favorite): void {
  const favs = read<Array<Stored & { savedAt: number }>>(FAV_KEY, []).filter((f) => f.id !== fav.id)
  favs.push({ ...pack(fav), savedAt: fav.savedAt })
  write(FAV_KEY, favs)
}

/* ---- recents ---- */

export function getRecents(): SongSummary[] {
  return read<SongSummary[]>(RECENT_KEY, [])
}

export function pushRecent(song: SongSummary): void {
  const { id, source, title, artist, url, score, key, thumb, version: v, kind } = song
  const entry: SongSummary = { id, source, title, artist, url, score, key, thumb, version: v, kind }
  const recents = read<SongSummary[]>(RECENT_KEY, []).filter((r) => r.id !== id)
  recents.unshift(entry)
  write(RECENT_KEY, recents.slice(0, 30))
}

export function removeRecent(id: string): void {
  write(
    RECENT_KEY,
    read<SongSummary[]>(RECENT_KEY, []).filter((r) => r.id !== id)
  )
}

export function clearRecents(): void {
  write(RECENT_KEY, [])
}

/* ---- song cache: recently opened sheets, for instant/offline reopen ---- */

export function cacheSong(song: SongDetail): void {
  const cache = read<Array<Stored & { cachedAt: number }>>(CACHE_KEY, []).filter((c) => c.id !== song.id)
  cache.unshift({ ...pack(song), cachedAt: Date.now() })
  // Cap the cache; drop oldest first. If storage is full, retry smaller.
  for (let cap = 40; cap >= 5; cap -= 5) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache.slice(0, cap)))
      return
    } catch {
      /* quota exceeded — retry with fewer entries */
    }
  }
}

export function getCachedSong(id: string): (SongDetail & { cachedAt: number }) | null {
  const c = read<Array<Stored & { cachedAt: number }>>(CACHE_KEY, []).find((x) => x.id === id)
  return c ? unpack(c) : null
}

export function clearSongCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
}

/* ---- per-song reading preferences ---- */

export interface SongPrefs {
  /** Transpose (semitones) of the sounding key. */
  steps: number
  /** Capo fret the user plays with (undefined = what the sheet says). */
  capo?: number
  /** Auto-scroll speed for this song. */
  speed?: number
}

export function getSongPrefs(id: string): SongPrefs {
  const map = read<Record<string, SongPrefs>>(SONG_PREFS_KEY, {})
  if (map[id]) return { ...map[id], steps: map[id].steps ?? 0 }
  // Transpose remembered by older versions.
  const legacy = read<Record<string, number>>(LEGACY_TRANSPOSE_KEY, {})
  return { steps: legacy[id] ?? 0 }
}

export function setSongPrefs(id: string, patch: Partial<SongPrefs>): void {
  const map = read<Record<string, SongPrefs>>(SONG_PREFS_KEY, {})
  const next: SongPrefs = { ...map[id], ...patch, steps: patch.steps ?? map[id]?.steps ?? 0 }
  if (next.steps === 0 && next.capo === undefined && next.speed === undefined) delete map[id]
  else map[id] = next
  try {
    localStorage.setItem(SONG_PREFS_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

/* ---- auto-scroll default speed ---- */

export function getScrollSpeed(): number {
  const n = Number(read<number | string>(SCROLL_SPEED_KEY, SCROLL_SPEED_DEFAULT))
  return Number.isFinite(n) && n >= SCROLL_SPEED_MIN && n <= SCROLL_SPEED_MAX ? n : SCROLL_SPEED_DEFAULT
}

export function setScrollSpeed(speed: number): void {
  try {
    localStorage.setItem(SCROLL_SPEED_KEY, JSON.stringify(speed))
  } catch {
    /* ignore */
  }
}

/* ---- search history ---- */

export function getSearchHistory(): string[] {
  return read<string[]>(HISTORY_KEY, [])
}

export function pushSearchHistory(q: string): void {
  const query = q.trim()
  if (!query || /^https?:\/\//i.test(query)) return
  const list = getSearchHistory().filter((x) => x.toLowerCase() !== query.toLowerCase())
  list.unshift(query)
  write(HISTORY_KEY, list.slice(0, 12))
}

export function removeSearchHistory(q: string): void {
  write(
    HISTORY_KEY,
    getSearchHistory().filter((x) => x !== q)
  )
}

/* ---- backup ---- */

const BACKUP_KEYS = [FAV_KEY, RECENT_KEY, SONG_PREFS_KEY, HISTORY_KEY, 'gc.prefs.v1', 'gc.backendUrl.v1', SCROLL_SPEED_KEY]

export function exportBackup(): string {
  const data: Record<string, unknown> = {}
  for (const k of BACKUP_KEYS) {
    const raw = localStorage.getItem(k)
    if (raw != null) data[k] = JSON.parse(raw)
  }
  return JSON.stringify({ app: 'acordes', version: 1, exportedAt: new Date().toISOString(), data }, null, 1)
}

/** Merge a backup: favorites are united (newest wins), the rest replaced. */
export function importBackup(json: string): { favorites: number } {
  const parsed = JSON.parse(json) as { app?: string; data?: Record<string, unknown> }
  if (parsed.app !== 'acordes' || !parsed.data) throw new Error('El archivo no es una copia de Acordes')
  let favorites = 0
  for (const [k, v] of Object.entries(parsed.data)) {
    if (!BACKUP_KEYS.includes(k)) continue
    if (k === FAV_KEY && Array.isArray(v)) {
      const current = read<Array<Stored & { savedAt: number }>>(FAV_KEY, [])
      const byId = new Map(current.map((f) => [f.id, f]))
      for (const f of v as Array<Stored & { savedAt: number }>) {
        const prev = byId.get(f.id)
        if (!prev || prev.savedAt < f.savedAt) byId.set(f.id, f)
      }
      favorites = byId.size
      localStorage.setItem(k, JSON.stringify([...byId.values()]))
    } else {
      localStorage.setItem(k, JSON.stringify(v))
    }
  }
  notify()
  return { favorites }
}

/** Ask the browser not to evict our data (iOS clears unused site data). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
