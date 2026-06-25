/** Small persisted settings (currently just the optional backend proxy URL). */

const BACKEND_KEY = 'gc.backendUrl.v1'

/**
 * Default backend proxy (a Cloudflare Worker) so the live app works out of the
 * box without any configuration. It can be changed or cleared from the Debug
 * panel; an empty string there is remembered and disables the default.
 */
const DEFAULT_BACKEND = 'https://acordes.fabianignaciomv.workers.dev'

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
    const stored = localStorage.getItem(BACKEND_KEY)
    // Never set -> use the default. Explicitly cleared ('') -> disabled.
    if (stored === null) return DEFAULT_BACKEND
    return stored.trim()
  } catch {
    return DEFAULT_BACKEND
  }
}

export function setBackendUrl(url: string): void {
  try {
    // Always store (even ''), so clearing the field disables the default
    // instead of silently falling back to it.
    localStorage.setItem(BACKEND_KEY, url.trim())
  } catch {
    /* ignore */
  }
}
