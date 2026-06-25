import type { ChordSource, SongDetail, SongSummary } from './types'
import { cifraclub } from './cifraclub'
import { ultimateGuitar } from './ultimateGuitar'
import { tusacordes } from './tusacordes'
import { lacuerda } from './lacuerda'
import { cifras } from './cifras'
import { logDebug } from '../lib/debug'

export const SOURCES: Record<string, ChordSource> = {
  cifraclub,
  'ultimate-guitar': ultimateGuitar,
  lacuerda,
  cifras,
  tusacordes,
}

// CifraClub first (proven reliable); the rest broaden coverage.
const SEARCH_ORDER: ChordSource[] = [cifraclub, ultimateGuitar, lacuerda, cifras, tusacordes]

/**
 * Search every source in parallel and merge results, best-rated first.
 * A failing source contributes nothing rather than breaking the search.
 */
export async function searchAll(query: string): Promise<SongSummary[]> {
  const q = query.trim()
  if (!q) return []

  logDebug({ kind: 'info', label: `Buscando "${q}"…` })
  const settled = await Promise.allSettled(SEARCH_ORDER.map((s) => s.search(q)))
  const all: SongSummary[] = []
  settled.forEach((r, i) => {
    const src = SEARCH_ORDER[i]
    if (r.status === 'fulfilled') {
      all.push(...r.value)
      logDebug({
        kind: 'source',
        ok: r.value.length > 0,
        label: `${src.label}: ${r.value.length} resultados`,
      })
    } else {
      logDebug({
        kind: 'source',
        ok: false,
        label: `${src.label}: error`,
        detail: String((r.reason as Error)?.message || r.reason),
      })
    }
  })

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
    else if (host.includes('lacuerda')) source = 'lacuerda'
    else if (host.includes('cifras.com')) source = 'cifras'
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
