import { proxyFetch } from '../lib/proxy'
import { decodeEntities, parseHTML } from '../lib/html'
import { CH_END, CH_START, tokenizeMarked, tokenizePlainText } from '../lib/chords'
import { logSampleLinks } from './diagnostics'
import type { ChordSource, Line, SongDetail, SongSummary } from './types'

/**
 * CIFRAS (cifras.com.br) adapter.
 *
 * Song pages live at /cifra/{artist}/{song}. Search is done by fetching the
 * site's HTML search results and collecting links that match that pattern.
 * The exact search URL may need calibration (see SEARCH candidates).
 */

const ORIGIN = 'https://www.cifras.com.br'

// Best-effort search URL; adjust once confirmed from a real response.
const SEARCH = (q: string) => `${ORIGIN}/busca?q=${encodeURIComponent(q)}`

const SONG_RE = /^\/cifra\/[^/]+\/[^/]+/

export const cifras: ChordSource = {
  id: 'cifras',
  label: 'CIFRAS',

  async search(query: string): Promise<SongSummary[]> {
    const html = await proxyFetch(SEARCH(query))
    const doc = parseHTML(html)
    const out: SongSummary[] = []
    const seen = new Set<string>()

    for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
      const href = a.getAttribute('href') || ''
      const path = href.replace(ORIGIN, '')
      if (!SONG_RE.test(path)) continue
      const url = href.startsWith('http') ? href : ORIGIN + path
      if (seen.has(url)) continue
      const text = (a.textContent || '').trim()
      if (!text || text.length < 2) continue
      seen.add(url)

      // Title from the link text; artist from the URL slug when possible.
      const artistSlug = path.split('/')[2] || ''
      const parts = text.split(/\s+[-–—]\s+/)
      out.push({
        id: `cifras:${url}`,
        source: 'cifras',
        title: decodeEntities(parts.length > 1 ? parts.slice(1).join(' - ') : text),
        artist: decodeEntities(parts.length > 1 ? parts[0] : artistSlug.replace(/[-_]+/g, ' ')),
        url,
        score: 0.55,
      })
      if (out.length >= 15) break
    }
    if (out.length === 0) logSampleLinks('CIFRAS', doc, html)
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
      if (!lines.some((l) => l.tokens.some((t) => t.chord))) {
        lines = tokenizePlainText(decodeEntities(pre.textContent || ''))
      }
    } else {
      const container =
        doc.querySelector('.cifra, .cifra_cnt, #cifra, article, main') || doc.body
      lines = tokenizePlainText(container?.textContent || '')
    }

    const title = doc.querySelector('h1')?.textContent?.trim() || summary.title || 'Canción'
    return { ...summary, title, lines }
  },
}
