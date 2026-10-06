import { fetchText } from '../lib/proxy'
import { elementToMarked, parseHTML, textOf } from '../lib/html'
import { tokenizeMarked, tokenizePlainText } from '../lib/chords'
import type { ChordSource, Line, SongDetail, SongSummary } from './types'

/**
 * TusAcordes — Spanish site; chords are written in Latin notation
 * ("Sim", "Sol", "Re"), which the tokenizer converts to English.
 *
 * Search results are <a class="list-group-item" href="/tab/{slug}-{type}-{id}">
 * with the title in <h5>, a type badge and the artist in <p><span>.
 * Song pages hold the sheet in .tablatura-content with chords as
 * <span class="acorde-interactivo">.
 */

const ORIGIN = 'https://www.tusacordes.com'
const SEARCH = (q: string) => `${ORIGIN}/buscar?q=${encodeURIComponent(q.trim()).replace(/%20/g, '+')}`
const TAB_RE = /\/tab\/[^/?#]+-(acordes|tablatura|teclado|bajo|bateria|armonica|ukulele|video_guitarra)-(\d+)\/?$/

export function parseTusAcordesSearch(html: string): SongSummary[] {
  const doc = parseHTML(html)
  const out: SongSummary[] = []
  const versions = new Map<string, number>()
  let rank = 0
  doc.querySelectorAll<HTMLAnchorElement>('a[href*="/tab/"]').forEach((a) => {
    const href = a.getAttribute('href') ?? ''
    const m = href.match(TAB_RE)
    if (!m || m[1] !== 'acordes') return
    const url = href.startsWith('http') ? href : ORIGIN + href
    const title = textOf(a, 'h5') ?? a.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    const artist = textOf(a, 'p span') ?? textOf(a, 'p')?.replace(/^de\s+/i, '') ?? ''
    if (!title || out.some((s) => s.url === url)) return
    const group = `${title.toLowerCase()}|${artist.toLowerCase()}`
    const n = (versions.get(group) ?? 0) + 1
    versions.set(group, n)
    if (n > 3) return // a few versions per song is plenty
    out.push({
      id: `tusacordes:${url}`,
      source: 'tusacordes',
      title,
      artist,
      url,
      score: 0.62 - (n - 1) * 0.03,
      popularity: Math.max(0.05, 0.35 - rank++ * 0.02),
      kind: 'chords',
      version: `v${n}`,
    })
  })
  // Only label versions when a song has more than one.
  for (const s of out) {
    const group = `${s.title.toLowerCase()}|${s.artist.toLowerCase()}`
    if ((versions.get(group) ?? 1) === 1) s.version = undefined
  }
  return out
}

export function parseTusAcordesSong(html: string, summary: SongSummary): SongDetail {
  const doc = parseHTML(html)
  const box = doc.querySelector('.tablatura-content')
  let lines: Line[] = []
  if (box) {
    lines = tokenizeMarked(elementToMarked(box, '.acorde-interactivo'))
    if (!lines.some((l) => l.tokens.some((t) => t.chord))) {
      lines = tokenizePlainText(box.textContent ?? '')
    }
  }
  const h1 = doc.querySelector('h1')
  h1?.querySelectorAll('.badge').forEach((b) => b.remove())
  const title = h1?.textContent?.replace(/\s+/g, ' ').trim() || summary.title
  const artist = textOf(doc, 'h2.h4') || summary.artist
  return { ...summary, title, artist, lines, fetchedAt: Date.now() }
}

export const tusacordes: ChordSource = {
  id: 'tusacordes',
  label: 'TusAcordes',
  hosts: ['tusacordes.com'],

  async search(query, opts) {
    const html = await fetchText(SEARCH(query), {
      select: '.list-group, main',
      cacheMs: 10 * 60_000,
      signal: opts?.signal,
      validate: (b) => (/\/tab\/|list-group|resultados/i.test(b) ? null : 'página inesperada'),
    })
    return parseTusAcordesSearch(html)
  },

  async fetchSong(summary, opts) {
    const html = await fetchText(summary.url, {
      select: '.tablatura-content, h1, h2.h4',
      signal: opts?.signal,
      validate: (b) => (/tablatura-content/.test(b) ? null : 'sin acordes en la página'),
    })
    return parseTusAcordesSong(html, summary)
  },
}
