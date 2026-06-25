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

type AnyDoc = Record<string, unknown>

/** Loosely parse JSON that may be wrapped in a JSONP callback or have junk. */
function parseJsonLoose(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    /* try to unwrap */
  }
  const start = raw.search(/[{[]/)
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'))
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1))
    } catch {
      /* give up */
    }
  }
  return null
}

/** Find the most likely array of result docs anywhere in the parsed JSON. */
function findDocsArray(data: unknown): AnyDoc[] {
  // Common shapes first.
  const d = data as AnyDoc
  const known = [
    (d?.response as AnyDoc)?.docs,
    d?.docs,
    d?.results,
    Array.isArray(data) ? data : undefined,
  ].find((x) => Array.isArray(x) && x.length) as AnyDoc[] | undefined
  if (known) return known

  // Otherwise, breadth-first search for an array of objects that look like docs.
  const queue: unknown[] = [data]
  while (queue.length) {
    const cur = queue.shift()
    if (Array.isArray(cur)) {
      if (cur.length && typeof cur[0] === 'object' && cur[0]) return cur as AnyDoc[]
      continue
    }
    if (cur && typeof cur === 'object') {
      queue.push(...Object.values(cur as AnyDoc))
    }
  }
  return []
}

const pick = (doc: AnyDoc, keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = doc[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

/**
 * Real CifraClub solr doc shape (confirmed from the live response):
 *   { t:"2", m:"Something", a:"The Beatles", d:"the-beatles", u:"something" }
 * where `t` is the TYPE ("2"=song, "1"=artist), `m` is the title, `a` the
 * artist, and the URL is built from `d` (artist slug) + `u` (song slug).
 */
const prettify = (slug: string) => slug.replace(/[-_]+/g, ' ').trim()

export const cifraclub: ChordSource = {
  id: 'cifraclub',
  label: 'CifraClub',

  async search(query: string): Promise<SongSummary[]> {
    const raw = await proxyFetch(SEARCH(query))
    const data = parseJsonLoose(raw) as AnyDoc | null
    if (!data) return []

    const docs =
      ((data.response as AnyDoc)?.docs as AnyDoc[] | undefined) ?? findDocsArray(data)
    const out: SongSummary[] = []
    for (const doc of docs) {
      // Only song docs (t==="2"); t==="1" are artists with no song slug.
      if (String(doc.t) !== '2') continue
      const artistSlug = pick(doc, ['d'])
      const songSlug = pick(doc, ['u'])
      if (!artistSlug || !songSlug) continue
      const url = `${BASE}/${artistSlug}/${songSlug}/`
      out.push({
        id: `cifraclub:${url}`,
        source: 'cifraclub',
        title: decodeEntities(pick(doc, ['m', 'title']) || prettify(songSlug)),
        artist: decodeEntities(pick(doc, ['a']) || prettify(artistSlug)),
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
