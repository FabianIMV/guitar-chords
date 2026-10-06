import { fetchText } from '../lib/proxy'
import { decodeEntities, parseHTML, textOf } from '../lib/html'
import { CH_END, CH_START, tokenizeMarked } from '../lib/chords'
import type { ChordSource, SongDetail, SongSummary } from './types'

/**
 * Ultimate Guitar — huge catalogue with ratings and vote counts, which is
 * exactly what we need to pick the best version.
 *
 * Pages embed their data as JSON in <div class="js-store" data-content>.
 * With a desktop browser the search page carries the results there; with a
 * mobile User-Agent (older Worker versions send an iPhone UA) it renders a
 * server-side list of <article data-tab-id> instead — both are parsed.
 *
 * UG sometimes answers real pages with HTTP 302; the fetch layer accepts
 * that from the Worker and validates the body instead.
 */

const SEARCH = (q: string) =>
  `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q)}`

interface UGResult {
  id?: number
  song_name?: string
  artist_name?: string
  tab_url?: string
  type?: string
  rating?: number
  votes?: number
  version?: number
  tonality_name?: string
  marketing_type?: string
}

type Store = { store?: { page?: { data?: Record<string, unknown> } } }

function readStores(doc: Document): Store[] {
  const out: Store[] = []
  doc.querySelectorAll('.js-store').forEach((el) => {
    const content = el.getAttribute('data-content')
    if (!content) return
    try {
      out.push(JSON.parse(content.includes('&quot;') ? decodeEntities(content) : content))
    } catch {
      /* skip */
    }
  })
  return out
}

/**
 * Version quality: Bayesian average of the rating (so 5★ from 3 votes
 * doesn't beat 4.8★ from 10 000), with a confidence bump for many votes.
 */
export function ugQuality(rating: number, votes: number, kind: 'chords' | 'tab'): number {
  const prior = 4.0
  const weight = 25
  const bayes = (votes * rating + weight * prior) / (votes + weight)
  const confidence = Math.min(1, Math.log10(votes + 1) / 4)
  const q = Math.pow(bayes / 5, 2) * (0.9 + 0.1 * confidence)
  return Math.round((kind === 'tab' ? q * 0.75 : q) * 1000) / 1000
}

function ugPopularity(votes: number): number {
  return Math.min(1, Math.log10(votes + 1) / 4.6)
}

function kindOf(type: string): 'chords' | 'tab' | null {
  const t = type.trim().toLowerCase()
  if (t === 'chords' || t === 'crd') return 'chords'
  if (t === 'tabs' || t === 'tab') return 'tab'
  return null // ukulele, bass, drums, pro, official, video…
}

function summary(
  url: string,
  title: string,
  artist: string,
  kind: 'chords' | 'tab',
  rating: number,
  votes: number,
  extra: Partial<SongSummary> = {}
): SongSummary {
  return {
    id: `ug:${url}`,
    source: 'ultimate-guitar',
    title,
    artist,
    url,
    kind,
    rating: rating || undefined,
    votes: votes || undefined,
    score: ugQuality(rating, votes, kind),
    popularity: ugPopularity(votes),
    ...extra,
  }
}

export function parseUGSearch(html: string): SongSummary[] {
  const doc = parseHTML(html)
  const out: SongSummary[] = []
  const seen = new Set<string>()

  // Desktop: JSON results.
  for (const store of readStores(doc)) {
    const results = store.store?.page?.data?.results as UGResult[] | undefined
    if (!Array.isArray(results)) continue
    for (const r of results) {
      if (!r.tab_url || !r.song_name || r.marketing_type) continue
      const kind = kindOf(r.type ?? '')
      if (!kind || seen.has(r.tab_url)) continue
      seen.add(r.tab_url)
      out.push(
        summary(r.tab_url, r.song_name, r.artist_name ?? '', kind, r.rating ?? 0, r.votes ?? 0, {
          version: r.version ? `v${r.version}` : undefined,
          key: r.tonality_name || undefined,
        })
      )
    }
  }
  if (out.length) return out

  // Mobile: server-rendered list.
  doc.querySelectorAll('article[data-tab-id]').forEach((art) => {
    const link = art.querySelector<HTMLAnchorElement>('a.js-link-song, a[href*="/tab/"]')
    const href = link?.getAttribute('href')
    if (!link || !href) return
    const kind = kindOf(textOf(art, '.ugm-list--type') ?? '')
    if (!kind) return
    const url = href.startsWith('http') ? href : `https://tabs.ultimate-guitar.com${href}`
    if (seen.has(url)) return
    seen.add(url)
    const full = art.querySelectorAll('.ugm-icon__star.active').length
    const half = art.querySelectorAll('.ugm-icon__star.half').length
    const votes = Number((textOf(art, '.ig-list--rating') ?? '').replace(/\D/g, '')) || 0
    // "Hotel California (ver 3)" → title + version
    const name = link.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    const ver = name.match(/\s*\(ver (\d+)\)\s*$/i)
    out.push(
      summary(
        url,
        ver ? name.slice(0, ver.index) : name,
        textOf(art, 'footer a') ?? '',
        kind,
        full + half * 0.5,
        votes,
        { version: `v${ver ? ver[1] : 1}` }
      )
    )
  })
  return out
}

const DIFFICULTY_ES: Record<string, string> = {
  novice: 'Principiante',
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
}

export function parseUGSong(html: string, base: SongSummary): SongDetail {
  const doc = parseHTML(html)
  const data = readStores(doc)
    .map((s) => s.store?.page?.data as Record<string, any> | undefined)
    .find((d) => d?.tab_view || d?.tab)
  if (!data) throw new Error('sin datos de Ultimate Guitar')
  const tabView = data.tab_view ?? {}
  const tab = data.tab ?? {}
  const content: string = tabView.wiki_tab?.content ?? tab.content ?? ''
  if (!content.trim()) throw new Error('versión sin contenido (¿Pro/Official?)')

  // [ch]..[/ch] are chords, [tab]..[/tab] wrap aligned chord/lyric blocks.
  const marked = content
    .replace(/\r\n?/g, '\n')
    .replace(/\[\/?tab\]/g, '')
    .replace(/\[ch\]/g, CH_START)
    .replace(/\[\/ch\]/g, CH_END)

  const meta = tabView.meta ?? {}
  const tuning: string | undefined = meta.tuning?.value
  const kind = kindOf(tab.type ?? '') ?? base.kind
  return {
    ...base,
    title: tab.song_name || base.title,
    artist: tab.artist_name || base.artist,
    lines: tokenizeMarked(marked),
    rating: tab.rating ?? base.rating,
    votes: tab.votes ?? base.votes,
    kind,
    version: tab.version ? `v${tab.version}` : base.version,
    capoFret: Number(meta.capo) || 0,
    key: meta.tonality || tab.tonality_name || base.key,
    tuning: tuning && !/^E A D G B E$/i.test(tuning.trim()) ? tuning : undefined,
    difficulty: DIFFICULTY_ES[String(meta.difficulty ?? tab.difficulty ?? '').toLowerCase()],
    fetchedAt: Date.now(),
  }
}

export const ultimateGuitar: ChordSource = {
  id: 'ultimate-guitar',
  label: 'Ultimate Guitar',
  hosts: ['ultimate-guitar.com', 'tabs.ultimate-guitar.com'],

  async search(query, opts) {
    const html = await fetchText(SEARCH(query), {
      select: '.js-store',
      cacheMs: 10 * 60_000,
      signal: opts?.signal,
      validate: (b) => (/js-store|ugm-list/.test(b) ? null : 'página de búsqueda inesperada'),
    })
    return parseUGSearch(html)
  },

  async fetchSong(summary, opts) {
    const html = await fetchText(summary.url, {
      select: '.js-store',
      signal: opts?.signal,
      validate: (b) => (/js-store/.test(b) && /wiki_tab|tab_view/.test(b) ? null : 'sin datos de la canción'),
    })
    return parseUGSong(html, summary)
  },
}
