import { fetchText } from '../lib/proxy'
import { elementToMarked, fragmentToMarked, parseHTML, textOf, unescapeJs } from '../lib/html'
import { tokenizeMarked, tokenizePlainText } from '../lib/chords'
import type { ChordSource, Line, SongDetail, SongSummary } from './types'

/**
 * LaCuerda (lacuerda.net) — the reference for Spanish/Latin repertoire
 * (it has no English songs).
 *
 * Search: the site's results page is filled by JavaScript from
 * m.lacuerda.net/iapp.php, which answers a tiny JS object:
 *   var res = { 'items': [ { 'url':'/soda_stereo/de_musica_ligera',
 *     'fd':'RHRTTTDTB', 'txt':'De Música Ligera', 'sub':'Soda Stereo' }, … ] }
 * `fd` lists the song's versions by type: R = acordes, T = tablatura,
 * H = armónica, B = bajo, D = batería. Version n lives at {url}-n.shtml
 * (version 1 has no suffix).
 *
 * Song pages: the desktop page has the sheet in #t_body <pre> with chords
 * as <A> tags; the mobile page (what a phone UA gets) builds it in JS as
 * `res.body += '…'` lines. Both are handled.
 */

const ORIGIN = 'https://acordes.lacuerda.net'
const SEARCH = (q: string) =>
  `https://m.lacuerda.net/iapp.php?exp=${encodeURIComponent(q.trim()).replace(/%20/g, '+')}&esweb=1`

interface Item {
  url?: string
  fd?: string
  txt?: string
  sub?: string
}

function parseItems(raw: string): Item[] {
  const items: Item[] = []
  const list = raw.slice(raw.indexOf("'items'"))
  for (const obj of list.match(/\{[^{}]*\}/g) ?? []) {
    const item: Record<string, string> = {}
    for (const m of obj.matchAll(/'(\w+)'\s*:\s*'((?:[^'\\]|\\.)*)'/g)) {
      item[m[1]] = unescapeJs(m[2])
    }
    items.push(item)
  }
  return items
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

export function versionUrl(path: string, n: number): string {
  return `${ORIGIN}${path}${n > 1 ? `-${n}` : ''}.shtml`
}

export function parseLaCuerdaSearch(raw: string): SongSummary[] {
  const out: SongSummary[] = []
  let rank = 0
  for (const item of parseItems(raw)) {
    const path = item.url
    // Songs have an artist ("sub"); artist/category entries end with "/".
    if (!path || !item.sub || path.endsWith('/') || !path.startsWith('/')) continue
    const title = stripTags(item.txt ?? '')
    const artist = stripTags(item.sub)
    if (!title) continue
    const popularity = Math.max(0.1, 0.55 - rank * 0.04)
    rank++

    // Chord versions ("R"); fall back to version 1 when unknown.
    const fd = item.fd ?? 'R'
    const versions: number[] = []
    for (let i = 0; i < fd.length; i++) if (fd[i] === 'R') versions.push(i + 1)
    if (versions.length === 0) continue
    versions.slice(0, 4).forEach((n, idx) => {
      const url = versionUrl(path, n)
      out.push({
        id: `lacuerda:${url}`,
        source: 'lacuerda',
        title,
        artist,
        url,
        score: idx === 0 ? 0.78 : 0.7 - idx * 0.03,
        popularity,
        kind: 'chords',
        version: versions.length > 1 ? `v${idx + 1}` : undefined,
      })
    })
  }
  return out
}

function jsField(html: string, name: string): string | undefined {
  const m = html.match(new RegExp(`'${name}'\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'`))
  return m ? unescapeJs(m[1]) : undefined
}

export function parseLaCuerdaSong(html: string, summary: SongSummary): SongDetail {
  const doc = parseHTML(html)
  let lines: Line[] = []

  const pre = doc.querySelector('#t_body pre') ?? doc.querySelector('#t_body')
  if (pre && pre.textContent?.trim()) {
    lines = tokenizeMarked(elementToMarked(pre, 'a'))
  } else {
    // Mobile page: concatenate the JS string pieces.
    const pieces: string[] = []
    const first = jsField(html, 'body')
    if (first) pieces.push(first)
    for (const m of html.matchAll(/res\.body\s*\+=\s*'((?:[^'\\]|\\.)*)'/g)) {
      pieces.push(unescapeJs(m[1]))
    }
    if (pieces.length) lines = tokenizeMarked(fragmentToMarked(pieces.join(''), 'a'))
  }
  if (!lines.some((l) => l.tokens.some((t) => t.chord))) {
    // Very old pages: plain text with chord lines.
    const plain = doc.querySelector('pre:not(#tCode)')?.textContent
    if (plain?.trim()) lines = tokenizePlainText(plain)
  }

  const heading = textOf(doc, '.mhTit') // "Acordes de Artist: Song"
  const fromHeading = heading?.match(/^\S+ de (.+?): (.+)$/)
  const title =
    textOf(doc, '#tH1 h1 a') || jsField(html, 'cancion') || fromHeading?.[2] || summary.title
  const artist =
    textOf(doc, '#tH1 h2 a') || jsField(html, 'banda') || fromHeading?.[1] || summary.artist
  const video = jsField(html, 'video')

  return {
    ...summary,
    title,
    artist,
    lines,
    videoId: video && /^[\w-]{11}$/.test(video) ? video : undefined,
    fetchedAt: Date.now(),
  }
}

export const lacuerda: ChordSource = {
  id: 'lacuerda',
  label: 'LaCuerda',
  hosts: ['lacuerda.net', 'acordes.lacuerda.net', 'm.lacuerda.net'],

  async search(query, opts) {
    const raw = await fetchText(SEARCH(query), {
      as: 'text',
      cacheMs: 10 * 60_000,
      signal: opts?.signal,
      validate: (b) => (/var\s+res\s*=/.test(b) ? null : 'respuesta inesperada'),
    })
    return parseLaCuerdaSearch(raw)
  },

  async fetchSong(summary, opts) {
    const html = await fetchText(summary.url, {
      select: '#t_body, #tH1',
      signal: opts?.signal,
      validate: (b) => (/t_body|res\.body/.test(b) ? null : 'sin acordes en la página'),
    })
    return parseLaCuerdaSong(html, summary)
  },
}
