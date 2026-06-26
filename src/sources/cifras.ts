import { proxyFetch } from '../lib/proxy'
import { decodeEntities, parseHTML } from '../lib/html'
import { CH_END, CH_START, tokenizeMarked, tokenizePlainText } from '../lib/chords'
import type { ChordSource, Line, SongDetail, SongSummary } from './types'

/**
 * CIFRAS (cifras.com.br) adapter.
 *
 * Search uses the site's JSON API (/api/search) which needs the
 * X-Requested-With header (added by the Worker). Song pages live at
 * /cifra/{artist}/{song} and are parsed for their <pre> chord block.
 */

const ORIGIN = 'https://www.cifras.com.br'

// Confirmed JSON search API. Requires the X-Requested-With header, which the
// Worker adds. We only ask for songs.
const SEARCH = (q: string) =>
  `${ORIGIN}/api/search?q=${encodeURIComponent(q)}&only[]=songs&songs_take=15`

type AnyObj = Record<string, unknown>

function asArray(v: unknown): AnyObj[] {
  return Array.isArray(v) ? (v as AnyObj[]) : []
}

/** Find the songs array in the API response, tolerating shape changes. */
function findSongs(data: unknown): AnyObj[] {
  const d = data as AnyObj
  const direct =
    asArray(d?.songs).length ? asArray(d?.songs)
    : asArray((d?.data as AnyObj)?.songs).length ? asArray((d?.data as AnyObj)?.songs)
    : asArray((d?.results as AnyObj)?.songs)
  if (direct.length) return direct
  // Fallback: first array of objects that have a url/slug-ish field.
  const queue: unknown[] = [data]
  while (queue.length) {
    const cur = queue.shift()
    if (Array.isArray(cur)) {
      if (cur.length && typeof cur[0] === 'object') return cur as AnyObj[]
    } else if (cur && typeof cur === 'object') {
      queue.push(...Object.values(cur as AnyObj))
    }
  }
  return []
}

const str = (o: AnyObj, keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

export const cifras: ChordSource = {
  id: 'cifras',
  label: 'CIFRAS',

  async search(query: string): Promise<SongSummary[]> {
    const raw = await proxyFetch(SEARCH(query))
    let data: unknown
    try {
      data = JSON.parse(raw)
    } catch {
      return []
    }

    const out: SongSummary[] = []
    const seen = new Set<string>()
    for (const song of findSongs(data)) {
      // URL: explicit field, else build /cifra/{artist}/{song} from slugs.
      const artistObj = (song.artist as AnyObj) || {}
      let path = str(song, ['url', 'path', 'link']) || str(artistObj, ['song_url'])
      const songSlug = str(song, ['slug', 'permalink'])
      const artistSlug = str(artistObj, ['slug', 'permalink']) || str(song, ['artist_slug'])
      if (!path && artistSlug && songSlug) path = `/cifra/${artistSlug}/${songSlug}`
      if (!path) continue
      const url = path.startsWith('http') ? path : ORIGIN + (path.startsWith('/') ? path : '/' + path)
      if (seen.has(url)) continue
      seen.add(url)

      out.push({
        id: `cifras:${url}`,
        source: 'cifras',
        title: decodeEntities(str(song, ['name', 'title', 'song']) || ''),
        artist: decodeEntities(
          str(artistObj, ['name', 'title']) || str(song, ['artist_name', 'artist']) || ''
        ),
        url,
        score: 0.55,
      })
      if (out.length >= 15) break
    }
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
