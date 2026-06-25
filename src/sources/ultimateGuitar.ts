import { proxyFetch } from '../lib/proxy'
import { decodeEntities, parseHTML } from '../lib/html'
import { CH_END, CH_START, tokenizeMarked } from '../lib/chords'
import type { ChordSource, SongDetail, SongSummary } from './types'

/**
 * Ultimate Guitar embeds all page data as JSON in a <div class="js-store"
 * data-content="...">. We parse that JSON for both search and tab content.
 * UG exposes ratings + vote counts, which we use to surface the best version.
 */

const SEARCH = (q: string) =>
  `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q)}`

function extractStore(html: string): any | null {
  const doc = parseHTML(html)
  const el = doc.querySelector('.js-store')
  const content = el?.getAttribute('data-content')
  if (!content) return null
  try {
    return JSON.parse(decodeEntities(content))
  } catch {
    return null
  }
}

interface UGResult {
  id?: number
  song_name?: string
  artist_name?: string
  tab_url?: string
  type?: string
  rating?: number
  votes?: number
  marketing_type?: string
}

export const ultimateGuitar: ChordSource = {
  id: 'ultimate-guitar',
  label: 'Ultimate Guitar',

  async search(query: string): Promise<SongSummary[]> {
    const html = await proxyFetch(SEARCH(query))
    const store = extractStore(html)
    const results: UGResult[] = store?.store?.page?.data?.results ?? []
    const out: SongSummary[] = []

    for (const r of results) {
      const type = (r.type || '').toLowerCase()
      // We only want chord/tab pages with lyrics, not Pro/Power/Official tabs.
      if (!r.tab_url || !r.song_name) continue
      if (!['chords', 'tab', 'tabs', 'ukulele chords'].includes(type)) continue

      const rating = r.rating ?? 0
      const votes = r.votes ?? 0
      // Quality score: rating weighted by confidence (more votes = more trust).
      const score = (rating / 5) * (1 - 1 / (1 + Math.log10(1 + votes)))

      out.push({
        id: `ug:${r.tab_url}`,
        source: 'ultimate-guitar',
        title: r.song_name,
        artist: r.artist_name || '',
        url: r.tab_url,
        rating,
        votes,
        score: Math.max(0.05, score),
      })
    }
    return out
  },

  async fetchSong(summary: SongSummary): Promise<SongDetail> {
    const html = await proxyFetch(summary.url)
    const store = extractStore(html)
    const data = store?.store?.page?.data
    const tabView = data?.tab_view
    const content: string =
      tabView?.wiki_tab?.content ?? data?.tab?.content ?? ''

    // UG content uses [ch]..[/ch] for chords and [tab]..[/tab] for aligned
    // blocks. Convert to our sentinels and normalize newlines.
    const marked = content
      .replace(/\r\n/g, '\n')
      .replace(/\[tab\]/g, '')
      .replace(/\[\/tab\]/g, '')
      .replace(/\[ch\]/g, CH_START)
      .replace(/\[\/ch\]/g, CH_END)

    const lines = tokenizeMarked(marked)

    const meta = tabView?.meta
    const capoNum = meta?.capo
    return {
      ...summary,
      title: data?.tab?.song_name || summary.title,
      artist: data?.tab?.artist_name || summary.artist,
      lines,
      capo: capoNum ? `traste ${capoNum}` : undefined,
      key: meta?.tonality || data?.tab?.tonality_name || undefined,
      tuning: meta?.tuning?.value || undefined,
    }
  },
}
