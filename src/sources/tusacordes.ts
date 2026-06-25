import { proxyFetch } from '../lib/proxy'
import { decodeEntities, parseHTML } from '../lib/html'
import { CH_END, CH_START, tokenizeMarked, tokenizePlainText } from '../lib/chords'
import { logSampleLinks } from './diagnostics'
import type { ChordSource, Line, SongDetail, SongSummary } from './types'

/**
 * TusAcordes adapter — best effort. The site's markup is less structured than
 * CifraClub/UG, so we use heuristics: find result links on the search page and
 * detect chord lines in the song body. Failures are swallowed by the
 * aggregator so they never break a search.
 */

const ORIGIN = 'https://www.tusacordes.com'
const SEARCH = (q: string) => `${ORIGIN}/buscar?q=${encodeURIComponent(q)}`

export const tusacordes: ChordSource = {
  id: 'tusacordes',
  label: 'TusAcordes',

  async search(query: string): Promise<SongSummary[]> {
    const html = await proxyFetch(SEARCH(query))
    const doc = parseHTML(html)
    const out: SongSummary[] = []
    const seen = new Set<string>()

    // Result links point to song pages; grab anchors that look like songs.
    const anchors = Array.from(doc.querySelectorAll('a[href]'))
    for (const a of anchors) {
      const href = a.getAttribute('href') || ''
      const text = a.textContent?.trim() || ''
      if (!text || text.length < 2) continue
      // Heuristic: song pages live under /acordes/ or similar deep paths.
      if (!/\/(acordes|cancion|cancin|letra)/i.test(href)) continue
      const url = href.startsWith('http') ? href : ORIGIN + (href.startsWith('/') ? href : '/' + href)
      if (seen.has(url)) continue
      seen.add(url)

      // Titles often look like "Artist - Song"
      const parts = text.split(/\s+[-–—]\s+/)
      const artist = parts.length > 1 ? parts[0] : ''
      const title = parts.length > 1 ? parts.slice(1).join(' - ') : text

      out.push({
        id: `tusacordes:${url}`,
        source: 'tusacordes',
        title: decodeEntities(title),
        artist: decodeEntities(artist),
        url,
        score: 0.5,
      })
      if (out.length >= 15) break
    }
    if (out.length === 0) logSampleLinks('TusAcordes', doc, html)
    return out
  },

  async fetchSong(summary: SongSummary): Promise<SongDetail> {
    const html = await proxyFetch(summary.url)
    const doc = parseHTML(html)

    let lines: Line[] = []
    const pre = doc.querySelector('pre')
    if (pre && /[A-G]/.test(pre.textContent || '')) {
      const marked = pre.innerHTML
        .replace(/<(b|strong|span)\b[^>]*>/gi, CH_START)
        .replace(/<\/(b|strong|span)>/gi, CH_END)
        .replace(/<br\s*\/?>(?:\r?\n)?/gi, '\n')
        .replace(/<[^>]+>/g, '')
      lines = tokenizeMarked(decodeEntities(marked))
      // If no chords were marked, fall back to text heuristics.
      if (!lines.some((l) => l.tokens.some((t) => t.chord))) {
        lines = tokenizePlainText(decodeEntities(pre.textContent || ''))
      }
    } else {
      // Look for a content container, else use the whole body text.
      const container =
        doc.querySelector('.cifra, .acordes, .chord-sheet, #cancion, article') ||
        doc.body
      lines = tokenizePlainText(container?.textContent || '')
    }

    const title =
      doc.querySelector('h1')?.textContent?.trim() || summary.title || 'Canción'

    return { ...summary, title, lines }
  },
}
