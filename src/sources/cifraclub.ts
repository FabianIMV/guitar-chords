import { fetchText } from '../lib/proxy'
import { decodeEntities, elementToMarked, parseHTML, parseJsonLoose, prettifySlug, textOf } from '../lib/html'
import { tokenizeMarked, tokenizePlainText } from '../lib/chords'
import type { ChordSource, Line, SongDetail, SongSummary } from './types'

/**
 * CifraClub — the biggest catalogue (Brazilian, with lots of Spanish and
 * English songs).
 *
 * Search: the SOLR autocomplete endpoint the site's own search box uses
 * (JSON, works through the Worker). Docs look like
 *   { t:"2", s:183.1, m:"De Música Ligera", a:"Soda Stereo",
 *     d:"soda-stereo", u:"de-musica-ligera", i:"5/5/b/8/…-tb.jpg" }
 * where t is the type (2 = song, 1 = artist), s the relevance score and i
 * the artist picture.
 *
 * Song pages sit behind Akamai, which rejects datacenter IPs (including
 * Cloudflare Workers), so they usually come through Jina. Since late 2025
 * the site is a Next.js app: the sheet is still a <pre> with <b> chords,
 * and key/capo/tuning live in "bento cards" (#key, #capo, #tuning).
 */

const BASE = 'https://www.cifraclub.com.br'
const SEARCH = (q: string) => `https://solr.sscdn.co/cc/h2/?type=&hl=true&q=${encodeURIComponent(q)}`
const THUMB = (i: string) => `https://akamai.sscdn.co/uploadfile/letras/fotos/${i}`

/** Only what we parse — keeps Jina's answer ~30 KB instead of ~500 KB. */
const SONG_SELECTOR = 'pre, h1, h2:not(.u-srOnly), #key, #capo, #tuning, #cifra_tom'

type Doc = Record<string, unknown>

const str = (doc: Doc, key: string): string | undefined => {
  const v = doc[key]
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

export function parseCifraClubSearch(raw: string): SongSummary[] {
  const data = parseJsonLoose(raw) as { response?: { docs?: Doc[] } } | null
  const docs = data?.response?.docs
  if (!Array.isArray(docs)) return []
  const songs = docs.filter((d) => String(d.t) === '2')
  const maxS = Math.max(1, ...songs.map((d) => Number(d.s) || 0))
  const out: SongSummary[] = []
  const seen = new Set<string>()
  for (const doc of songs) {
    const artistSlug = str(doc, 'd')
    const songSlug = str(doc, 'u')
    if (!artistSlug || !songSlug) continue
    const url = `${BASE}/${artistSlug}/${songSlug}/`
    if (seen.has(url)) continue
    seen.add(url)
    const img = str(doc, 'i')
    out.push({
      id: `cifraclub:${url}`,
      source: 'cifraclub',
      title: decodeEntities(str(doc, 'm') || prettifySlug(songSlug)),
      artist: decodeEntities(str(doc, 'a') || prettifySlug(artistSlug)),
      url,
      // CifraClub's main version is curated and usually excellent.
      score: 0.86,
      popularity: Math.max(0.05, (Number(doc.s) || 0) / maxS),
      kind: 'chords',
      thumb: img ? THUMB(img) : undefined,
    })
  }
  return out
}

/** The value shown in one of the song's info cards (#key, #capo, …). */
function cardValue(doc: Document, id: string): string | undefined {
  const card = doc.getElementById(id)
  if (!card) return undefined
  const texts = Array.from(card.querySelectorAll('p, span'))
    .filter((el) => el.children.length === 0)
    .map((el) => el.textContent?.trim() ?? '')
    .filter(Boolean)
  // First text is the label ("Tom", "Capotraste"), the next one the value.
  return texts[1] ?? undefined
}

export function parseCapo(text: string | undefined): number | undefined {
  if (!text) return undefined
  if (/sem capo|sin capo|no capo|sem capotraste|sin cejilla/i.test(text)) return 0
  const m = text.match(/(\d{1,2})/)
  return m ? Number(m[1]) : undefined
}

const TUNING_ES: Record<string, string | null> = {
  padrão: null,
  standard: null,
  'meio tom abaixo': 'Medio tono abajo',
  'um tom abaixo': 'Un tono abajo',
  'drop d': 'Drop D',
}

export function parseCifraClubSong(html: string, summary: SongSummary): SongDetail {
  const doc = parseHTML(html)
  const pre = doc.querySelector('pre')
  let lines: Line[]
  if (pre) {
    lines = tokenizeMarked(elementToMarked(pre, 'b'))
  } else {
    lines = tokenizePlainText(doc.body?.textContent ?? '')
  }

  const h1 = doc.querySelector('h1')
  const title =
    textOf(doc, 'h1.t1') ||
    h1?.textContent?.replace(/\s+/g, ' ').trim() ||
    summary.title ||
    'Canción'
  const artist =
    textOf(doc, 'h2.t3 a') ||
    Array.from(doc.querySelectorAll('h2'))
      .map((h) => h.textContent?.trim() ?? '')
      .find((t) => t && !/menu|menú/i.test(t)) ||
    summary.artist

  const key = cardValue(doc, 'key') || textOf(doc, '#cifra_tom a') || textOf(doc, '#cifra_tom')
  const capoText =
    cardValue(doc, 'capo') ||
    (doc.body?.textContent ?? '').match(/Capotraste[^0-9]{0,20}?(\d+)\s*ª?\s*casa/i)?.[0]
  const tuningRaw = cardValue(doc, 'tuning')
  const tuningKey = tuningRaw?.toLowerCase()
  const tuning =
    tuningKey && tuningKey in TUNING_ES ? TUNING_ES[tuningKey] ?? undefined : tuningRaw

  return {
    ...summary,
    title,
    artist,
    lines,
    key: key && key.length <= 6 ? key : summary.key,
    capoFret: parseCapo(capoText),
    tuning,
    fetchedAt: Date.now(),
  }
}

export const cifraclub: ChordSource = {
  id: 'cifraclub',
  label: 'CifraClub',
  hosts: ['cifraclub.com.br', 'cifraclub.com', 'm.cifraclub.com.br'],

  async search(query, opts) {
    const raw = await fetchText(SEARCH(query), {
      as: 'text',
      cacheMs: 10 * 60_000,
      signal: opts?.signal,
      validate: (b) => (/"docs"\s*:/.test(b) ? null : 'respuesta sin "docs"'),
    })
    return parseCifraClubSearch(raw)
  },

  async fetchSong(summary, opts) {
    const html = await fetchText(summary.url, {
      select: SONG_SELECTOR,
      signal: opts?.signal,
      validate: (b) => {
        if (/NEXT_HTTP_ERROR_FALLBACK;404|Alguém pegou todas as nossas palhetas/.test(b)) {
          return 'la canción no existe (404)'
        }
        return /<pre[\s>]/i.test(b) ? null : 'sin cifra (<pre>)'
      },
    })
    return parseCifraClubSong(html, summary)
  },
}
