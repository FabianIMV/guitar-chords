/**
 * CORS proxy layer.
 *
 * GitHub Pages is static hosting: the browser cannot fetch cifraclub.com.br /
 * ultimate-guitar.com directly because those sites don't send CORS headers.
 * We route requests through public CORS proxies that fetch the page
 * server-side and return it with permissive headers. We try several in order
 * so that if one is down or rate-limited, the next is used.
 *
 * If you find these unreliable, the most robust fix is to deploy your own tiny
 * proxy (e.g. a Cloudflare Worker) and put its URL first in PROXIES.
 */

type ProxyBuilder = (target: string) => string

const PROXIES: ProxyBuilder[] = [
  (t) => `https://corsproxy.io/?url=${encodeURIComponent(t)}`,
  (t) => `https://api.allorigins.win/raw?url=${encodeURIComponent(t)}`,
  (t) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(t)}`,
  (t) => `https://thingproxy.freeboard.io/fetch/${t}`,
]

// Remember which proxy worked last so we hit it first next time.
let preferred = 0

const TIMEOUT_MS = 15000

async function tryFetch(url: string): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'text/html,application/json,*/*' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    if (!text || text.length < 32) throw new Error('empty response')
    return text
  } finally {
    clearTimeout(timer)
  }
}

/** Fetch a remote URL's body as text, transparently going through a CORS proxy. */
export async function proxyFetch(target: string): Promise<string> {
  const order = [preferred, ...PROXIES.keys()].filter(
    (v, i, a) => a.indexOf(v) === i
  )
  let lastErr: unknown
  for (const idx of order) {
    try {
      const text = await tryFetch(PROXIES[idx](target))
      preferred = idx
      return text
    } catch (err) {
      lastErr = err
    }
  }
  throw new Error(
    `No se pudo cargar la página (todos los proxies fallaron): ${String(lastErr)}`
  )
}
