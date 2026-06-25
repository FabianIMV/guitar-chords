import type { ChordSource, SongDetail, SongSummary } from './types'
import { cifraclub } from './cifraclub'
import { ultimateGuitar } from './ultimateGuitar'
import { tusacordes } from './tusacordes'

export const SOURCES: Record<string, ChordSource> = {
  'ultimate-guitar': ultimateGuitar,
  cifraclub,
  tusacordes,
}

const SEARCH_ORDER: ChordSource[] = [ultimateGuitar, cifraclub, tusacordes]

/**
 * Search every source in parallel and merge results, best-rated first.
 * A failing source contributes nothing rather than breaking the search.
 */
export async function searchAll(query: string): Promise<SongSummary[]> {
  const q = query.trim()
  if (!q) return []

  const settled = await Promise.allSettled(SEARCH_ORDER.map((s) => s.search(q)))
  const all: SongSummary[] = []
  for (const r of settled) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  // Sort by score (desc), then by votes as a tie-breaker.
  all.sort((a, b) => b.score - a.score || (b.votes ?? 0) - (a.votes ?? 0))
  return all
}

export async function fetchSong(summary: SongSummary): Promise<SongDetail> {
  const source = SOURCES[summary.source]
  if (!source) throw new Error(`Fuente desconocida: ${summary.source}`)
  return source.fetchSong(summary)
}

/** Detect a pasted song URL and turn it into a fetchable summary. */
export function summaryFromUrl(url: string): SongSummary | null {
  try {
    const u = new URL(url.trim())
    const host = u.hostname.replace(/^www\./, '')
    let source: SongSummary['source']
    if (host.includes('cifraclub')) source = 'cifraclub'
    else if (host.includes('ultimate-guitar')) source = 'ultimate-guitar'
    else if (host.includes('tusacordes')) source = 'tusacordes'
    else return null
    return {
      id: `${source}:${u.href}`,
      source,
      title: decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || 'Canción').replace(/[-_]/g, ' '),
      artist: '',
      url: u.href,
      score: 1,
    }
  } catch {
    return null
  }
}
