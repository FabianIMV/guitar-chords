import { fetchText } from './proxy'
import { fold } from './html'

/**
 * Lightweight YouTube integration (no login, no API key).
 *
 * - Deep links to YouTube Music / YouTube search always work (and open the
 *   native app on iOS).
 * - For the inline player we read the public results page through the
 *   proxy and pick the best video (skipping ads, Shorts and live streams),
 *   then embed it with youtube-nocookie.
 */

export function ytMusicSearchUrl(query: string): string {
  return `https://music.youtube.com/search?q=${encodeURIComponent(query)}`
}

export function ytSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

export function embedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&autoplay=1`
}

export interface VideoHit {
  id: string
  title: string
}

/** Regular video results from a YouTube results page, in order. */
export function parseVideoResults(html: string): VideoHit[] {
  const out: VideoHit[] = []
  const re = /"videoRenderer":\{"videoId":"([\w-]{11})"(.{0,1500}?)"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && out.length < 10) {
    const between = m[2]
    if (/"badges":\[\{"metadataBadgeRenderer":\{"style":"BADGE_STYLE_TYPE_LIVE_NOW"/.test(between)) continue
    if (!out.some((v) => v.id === m![1])) out.push({ id: m[1], title: JSON.parse(`"${m[3]}"`) as string })
  }
  if (out.length === 0) {
    const any = html.match(/"videoId":"([\w-]{11})"/)
    if (any) out.push({ id: any[1], title: '' })
  }
  return out
}

/** Pick the result whose title best matches the song. */
export function pickVideo(hits: VideoHit[], title: string, artist: string): string | null {
  if (hits.length === 0) return null
  const want = fold(`${title} ${artist}`).split(/\W+/).filter((w) => w.length > 2)
  const score = (h: VideoHit, i: number) => {
    const t = fold(h.title)
    let s = want.filter((w) => t.includes(w)).length / Math.max(1, want.length)
    if (/official|oficial|audio/.test(t)) s += 0.15
    if (/cover|karaoke|tutorial|lesson|como tocar|acordes|reaction/.test(t)) s -= 0.4
    return s - i * 0.03
  }
  return hits
    .map((h, i) => ({ h, s: score(h, i) }))
    .sort((a, b) => b.s - a.s)[0].h.id
}

export async function resolveVideoId(title: string, artist: string): Promise<string | null> {
  const html = await fetchText(ytSearchUrl(`${artist} ${title}`.trim()), {
    cacheMs: 30 * 60_000,
    validate: (b) => (/"videoId":"/.test(b) ? null : 'sin videos'),
  })
  return pickVideo(parseVideoResults(html), title, artist)
}
