import { proxyFetch } from '../lib/proxy'
import { decodeEntities, parseHTML } from '../lib/html'
import { CH_END, CH_START, tokenizeMarked, tokenizePlainText } from '../lib/chords'
import type { ChordSource, Line, SongDetail, SongSummary } from './types'

const BASE = 'https://www.cifraclub.com.br'

/**
 * CifraClub uses a SOLR autocomplete endpoint for search (the same one the
 * site's own search box hits). It returns JSON with a `response.docs` array.
 * Field names are short codes; we read them defensively.
 */
const SEARCH = (q: string) =>
  `https://solr.sscdn.co/cc/h2/?type=&hl=true&q=${encodeURIComponent(q)}`

interface SolrDoc {
  t?: string // title
  a?: string // artist
  u?: string // url path
  d?: string // domain
  m?: string // mobile/type marker
  dn?: number
}

function buildUrl(doc: SolrDoc): string | null {
  if (!doc.u) return null
  const domain = doc.d || 'cifraclub.com.br'
  if (!domain.includes('cifraclub')) return null // skip non-cifraclub docs
  const path = doc.u.startsWith('/') ? doc.u : '/' + doc.u
  return `https://www.${domain.replace(/^www\./, '')}${path}`
}

export const cifraclub: ChordSource = {
  id: 'cifraclub',
  label: 'CifraClub',

  async search(query: string): Promise<SongSummary[]> {
    const raw = await proxyFetch(SEARCH(query))
    let data: { response?: { docs?: SolrDoc[] } }
    try {
      // Endpoint sometimes wraps JSON in a JSONP callback — strip it.
      const jsonText = raw.replace(/^[^{[]*/, '').replace(/\);?\s*$/, '')
      data = JSON.parse(jsonText)
    } catch {
      return []
    }
    const docs = data.response?.docs ?? []
    const out: SongSummary[] = []
    for (const doc of docs) {
      const url = buildUrl(doc)
      if (!url || !doc.t) continue
      // Only song pages (skip artist-only entries which usually lack a song slug)
      if (url.replace(BASE, '').split('/').filter(Boolean).length < 2) continue
      out.push({
        id: `cifraclub:${url}`,
        source: 'cifraclub',
        title: decodeEntities(doc.t),
        artist: decodeEntities(doc.a || ''),
        url,
        // CifraClub doesn't expose ratings; give a solid baseline score.
        score: 0.7,
      })
    }
    // De-dupe by url
    const seen = new Set<string>()
    return out.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)))
  },

  async fetchSong(summary: SongSummary): Promise<SongDetail> {
    const html = await proxyFetch(summary.url)
    const doc = parseHTML(html)

    const pre = doc.querySelector('pre')
    let lines: Line[]
    if (pre) {
      // Chords are wrapped in <b> tags inside the <pre>. Convert to sentinels,
      // strip remaining tags, decode entities, then tokenize.
      const marked = pre.innerHTML
        .replace(/<b\b[^>]*>/gi, CH_START)
        .replace(/<\/b>/gi, CH_END)
        .replace(/<br\s*\/?>(?:\r?\n)?/gi, '\n')
        .replace(/<[^>]+>/g, '')
      lines = tokenizeMarked(decodeEntities(marked))
    } else {
      lines = tokenizePlainText(doc.body?.textContent ?? '')
    }

    const meta = (sel: string) =>
      doc.querySelector(sel)?.textContent?.trim() || undefined

    const title =
      meta('h1.t1') ||
      summary.title ||
      doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
      'Canción'
    const artist = meta('h2.t3 a') || meta('.t3') || summary.artist

    // Capo / key live in the song's toolbar, labelled in Portuguese.
    const bodyText = doc.body?.textContent || ''
    const capoMatch = bodyText.match(/Capotraste[^0-9]*?(\d+)\s*ª?\s*casa/i)
    const tomMatch = doc.querySelector('#cifra_tom')?.textContent?.trim()

    return {
      ...summary,
      title,
      artist,
      lines,
      capo: capoMatch ? `${capoMatch[1]}ª casa` : undefined,
      key: tomMatch || undefined,
    }
  },
}
