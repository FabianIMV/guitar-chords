import { proxyFetch } from '../lib/proxy'
import { decodeEntities, parseHTML } from '../lib/html'
import { tokenizePlainText } from '../lib/chords'
import { logSampleLinks } from './diagnostics'
import type { ChordSource, Line, SongDetail, SongSummary } from './types'

/**
 * LaCuerda (lacuerda.net) adapter — strong Spanish/Latin repertoire.
 *
 * Chord pages live on acordes.lacuerda.net as /{artist}/{song}.shtml and use
 * plain-text chords above the lyrics (no chord markup), so we rely on the
 * plain-text chord-line detector. Search collects links matching that pattern
 * from the site's HTML results; the exact search URL may need calibration.
 */

const ORIGIN = 'https://acordes.lacuerda.net'

// Best-effort search URL; adjust once confirmed from a real response.
const SEARCH = (q: string) => `${ORIGIN}/tabs/?b=${encodeURIComponent(q)}`

const SONG_RE = /^\/[^/]+\/[^/]+\.shtml/

export const lacuerda: ChordSource = {
  id: 'lacuerda',
  label: 'LaCuerda',

  async search(query: string): Promise<SongSummary[]> {
    const html = await proxyFetch(SEARCH(query))
    const doc = parseHTML(html)
    const out: SongSummary[] = []
    const seen = new Set<string>()

    for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
      const href = a.getAttribute('href') || ''
      const path = href.replace(/^https?:\/\/[^/]+/, '')
      if (!SONG_RE.test(path)) continue
      const url = href.startsWith('http') ? href : ORIGIN + path
      if (seen.has(url)) continue
      const text = (a.textContent || '').trim()
      if (!text || text.length < 2) continue
      seen.add(url)

      const artistSlug = path.split('/')[1] || ''
      const parts = text.split(/\s+[-–—]\s+/)
      out.push({
        id: `lacuerda:${url}`,
        source: 'lacuerda',
        title: decodeEntities(parts.length > 1 ? parts.slice(1).join(' - ') : text),
        artist: decodeEntities(parts.length > 1 ? parts[0] : artistSlug.replace(/[-_]+/g, ' ')),
        url,
        score: 0.6,
      })
      if (out.length >= 15) break
    }
    if (out.length === 0) logSampleLinks('LaCuerda', doc)
    return out
  },

  async fetchSong(summary: SongSummary): Promise<SongDetail> {
    const html = await proxyFetch(summary.url)
    const doc = parseHTML(html)

    // LaCuerda puts the chord sheet in <pre>; fall back to the page text.
    const pre = doc.querySelector('pre')
    const source = pre?.textContent && /[A-G]/.test(pre.textContent)
      ? pre.textContent
      : doc.querySelector('#t, .t, article, main')?.textContent || doc.body?.textContent || ''
    const lines: Line[] = tokenizePlainText(decodeEntities(source))

    const title = doc.querySelector('h1')?.textContent?.trim() || summary.title || 'Canción'
    return { ...summary, title, lines }
  },
}
