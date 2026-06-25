/** Small persisted settings (currently just the optional backend proxy URL). */

const BACKEND_KEY = 'gc.backendUrl.v1'

/**
 * Optional user-deployed proxy backend (e.g. a Cloudflare Worker). When set,
 * it is used first for all fetches because it can send the correct
 * Referer/User-Agent headers that public CORS proxies cannot — which is what
 * makes CifraClub/UG actually return data. See worker/README.md.
 *
 * The backend must accept `?url=<encoded target>` and return the raw body with
 * `Access-Control-Allow-Origin: *`.
 */
export function getBackendUrl(): string {
  try {
    return localStorage.getItem(BACKEND_KEY)?.trim() || ''
  } catch {
    return ''
  }
}

export function setBackendUrl(url: string): void {
  try {
    const clean = url.trim()
    if (clean) localStorage.setItem(BACKEND_KEY, clean)
    else localStorage.removeItem(BACKEND_KEY)
  } catch {
    /* ignore */
  }
}
