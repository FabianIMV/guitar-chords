import type { SongDetail, SongSummary } from '../sources/types'

const FAV_KEY = 'gc.favorites.v1'
const RECENT_KEY = 'gc.recents.v1'
const CACHE_KEY = 'gc.songCache.v1'
const FONT_KEY = 'gc.fontSize.v1'
const TRANSPOSE_KEY = 'gc.transpose.v1'
const SCROLL_SPEED_KEY = 'gc.scrollSpeed.v1'

export const SCROLL_SPEED_MIN = 0.3
export const SCROLL_SPEED_MAX = 10
const SCROLL_SPEED_DEFAULT = 3

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

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or disabled — ignore */
  }
}

export function getFavorites(): Favorite[] {
  return read<Favorite[]>(FAV_KEY, []).sort((a, b) => b.savedAt - a.savedAt)
}

export function isFavorite(id: string): boolean {
  return read<Favorite[]>(FAV_KEY, []).some((f) => f.id === id)
}

export function toggleFavorite(song: SongDetail): boolean {
  const favs = read<Favorite[]>(FAV_KEY, [])
  const idx = favs.findIndex((f) => f.id === song.id)
  if (idx >= 0) {
    favs.splice(idx, 1)
    write(FAV_KEY, favs)
    return false
  }
  favs.push({ ...song, savedAt: Date.now() })
  write(FAV_KEY, favs)
  return true
}

export function removeFavorite(id: string): void {
  write(
    FAV_KEY,
    read<Favorite[]>(FAV_KEY, []).filter((f) => f.id !== id)
  )
}

export function getRecents(): SongSummary[] {
  return read<SongSummary[]>(RECENT_KEY, [])
}

export function pushRecent(song: SongSummary): void {
  const recents = read<SongSummary[]>(RECENT_KEY, []).filter((r) => r.id !== song.id)
  recents.unshift(song)
  write(RECENT_KEY, recents.slice(0, 20))
}

/* ---- Song cache: recently opened sheets, for instant/offline reopen ---- */

interface CachedSong extends SongDetail {
  cachedAt: number
}

export function cacheSong(song: SongDetail): void {
  const cache = read<CachedSong[]>(CACHE_KEY, []).filter((c) => c.id !== song.id)
  cache.unshift({ ...song, cachedAt: Date.now() })
  // Cap the cache; drop oldest first. If storage is full, retry smaller.
  for (let cap = 20; cap >= 5; cap -= 5) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache.slice(0, cap)))
      return
    } catch {
      /* quota exceeded — retry with fewer entries */
    }
  }
}

export function getCachedSong(id: string): SongDetail | null {
  return read<CachedSong[]>(CACHE_KEY, []).find((c) => c.id === id) ?? null
}

/* ---- Reading preferences ---- */

export function getFontSize(): number {
  const n = Number(read<number | string>(FONT_KEY, 15))
  return Number.isFinite(n) && n >= 11 && n <= 26 ? n : 15
}

export function setFontSize(size: number): void {
  write(FONT_KEY, size)
}

/** Per-song transpose steps, so a song reopens in "your" key. */
export function getTranspose(id: string): number {
  const map = read<Record<string, number>>(TRANSPOSE_KEY, {})
  return map[id] ?? 0
}

export function setTranspose(id: string, steps: number): void {
  const map = read<Record<string, number>>(TRANSPOSE_KEY, {})
  if (steps === 0) delete map[id]
  else map[id] = steps
  write(TRANSPOSE_KEY, map)
}

/** Auto-scroll speed, remembered across songs and app restarts. */
export function getScrollSpeed(): number {
  const n = Number(read<number | string>(SCROLL_SPEED_KEY, SCROLL_SPEED_DEFAULT))
  return Number.isFinite(n) && n >= SCROLL_SPEED_MIN && n <= SCROLL_SPEED_MAX
    ? n
    : SCROLL_SPEED_DEFAULT
}

export function setScrollSpeed(speed: number): void {
  write(SCROLL_SPEED_KEY, speed)
}
