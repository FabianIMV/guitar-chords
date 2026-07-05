import { proxyFetch } from './proxy'

/**
 * Lightweight YouTube integration (no login, no API key).
 *
 * - Deep links to YouTube Music / YouTube search always work (and open the
 *   native app on iOS).
 * - For an inline player we resolve the first search result's videoId by
 *   reading the public results page through the proxy, then embed it.
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

/** Resolve the first video id for a query from the public results page. */
export async function resolveVideoId(query: string): Promise<string | null> {
  const html = await proxyFetch(ytSearchUrl(query))
  // The results page embeds ytInitialData JSON; grab the first videoId.
  const m = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/)
  return m ? m[1] : null
}
