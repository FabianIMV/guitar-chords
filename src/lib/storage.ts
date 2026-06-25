import type { SongDetail, SongSummary } from '../sources/types'

const FAV_KEY = 'gc.favorites.v1'
const RECENT_KEY = 'gc.recents.v1'

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
