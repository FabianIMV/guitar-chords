import { fetchText } from '../lib/proxy'
import { elementToMarked, parseHTML, parseJsonLoose, textOf } from '../lib/html'
import { tokenizeMarked, tokenizePlainText } from '../lib/chords'
import type { ChordSource, Line, SongDetail, SongSummary } from './types'

/**
 * CIFRAS (cifras.com.br) — PARKED: not used in searches.
 *
 * Its /api/search JSON works through the Worker, but every song page sits
 * behind a Cloudflare challenge ("Just a moment…") that neither the Worker
 * nor Jina can pass, so results could never be opened. The adapter stays
 * so pasted URLs still get a best-effort attempt.
 */

const ORIGIN = 'https://www.cifras.com.br'
const SEARCH = (q: string) =>
  `${ORIGIN}/api/search?q=${encodeURIComponent(q)}&only[]=songs&songs_take=15`

type Obj = Record<string, unknown>
const str = (o: Obj, keys: string[]) => {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

export const cifras: ChordSource = {
  id: 'cifras',
  label: 'CIFRAS',
  hosts: ['cifras.com.br'],

  async search(query, opts) {
    const raw = await fetchText(SEARCH(query), { as: 'text', signal: opts?.signal })
    const data = parseJsonLoose(raw) as { songs?: { hits?: Obj[] } } | null
    const hits = data?.songs?.hits ?? []
    return hits
      .map((song): SongSummary | null => {
        const songSlug = str(song, ['COD_TITULO'])
        const artistSlug = str(song, ['COD_ARTISTA'])
        if (!songSlug || !artistSlug) return null
        const url = `${ORIGIN}/cifra/${artistSlug}/${songSlug}`
        return {
          id: `cifras:${url}`,
          source: 'cifras',
          title: str(song, ['TITULO']) ?? songSlug,
          artist: str(song, ['ARTISTA']) ?? artistSlug,
          url,
          score: 0.5,
          kind: 'chords',
        }
      })
      .filter((s): s is SongSummary => !!s)
  },

  async fetchSong(summary, opts): Promise<SongDetail> {
    const html = await fetchText(summary.url, {
      signal: opts?.signal,
      validate: (b) => (/<pre[\s>]/i.test(b) ? null : 'sin cifra (<pre>)'),
    })
    const doc = parseHTML(html)
    const pre = doc.querySelector('pre')
    let lines: Line[] = []
    if (pre) {
      lines = tokenizeMarked(elementToMarked(pre, 'b, strong'))
      if (!lines.some((l) => l.tokens.some((t) => t.chord))) {
        lines = tokenizePlainText(pre.textContent ?? '')
      }
    }
    return {
      ...summary,
      title: textOf(doc, 'h1') || summary.title,
      lines,
      fetchedAt: Date.now(),
    }
  },
}
