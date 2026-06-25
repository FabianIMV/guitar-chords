/**
 * Fetch layer. GitHub Pages is static, so the browser cannot fetch
 * cifraclub.com.br / ultimate-guitar.com directly (no CORS headers, and some
 * endpoints also require a specific Referer). We route through proxies:
 *
 *  1. The user's own backend (a Cloudflare Worker), if configured — most
 *     reliable, because it can set the right Referer/User-Agent. See worker/.
 *  2. A list of public CORS proxies, tried in order, as a best-effort fallback.
 *
 * Every attempt is recorded in the in-app debug log so failures are visible.
 */

import { logDebug } from './debug'
import { getBackendUrl } from './settings'

interface Proxy {
  name: string
  build: (target: string) => string
  /** Extra request headers (e.g. Jina's return-format hint). */
  headers?: Record<string, string>
  /** If the proxy wraps the body in JSON, extract the real body. */
  unwrap?: (raw: string) => string
}

const PUBLIC_PROXIES: Proxy[] = [
  {
    // Jina Reader renders pages with a real browser, so it bypasses many
    // blocks without any account. Ask for raw HTML so our parsers still work.
    name: 'jina',
    build: (t) => `https://r.jina.ai/${t}`,
    headers: { 'X-Return-Format': 'html' },
  },
  {
    name: 'allorigins/raw',
    build: (t) => `https://api.allorigins.win/raw?url=${encodeURIComponent(t)}`,
  },
  {
    name: 'codetabs',
    build: (t) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(t)}`,
  },
  {
    name: 'corsproxy.io',
    build: (t) => `https://corsproxy.io/?url=${encodeURIComponent(t)}`,
  },
  {
    name: 'allorigins/get',
    build: (t) => `https://api.allorigins.win/get?url=${encodeURIComponent(t)}`,
    unwrap: (raw) => {
      try {
        return JSON.parse(raw).contents ?? raw
      } catch {
        return raw
      }
    },
  },
  {
    name: 'thingproxy',
    build: (t) => `https://thingproxy.freeboard.io/fetch/${t}`,
  },
]

const TIMEOUT_MS = 9000
const MAX_PUBLIC_ATTEMPTS = 3 // fail fast instead of leaving the user spinning
let preferred = 0 // index into the active public-proxy list

function backendProxy(): Proxy | null {
  const url = getBackendUrl()
  if (!url) return null
  const sep = url.includes('?') ? '&' : '?'
  return {
    name: 'backend',
    build: (t) => `${url}${sep}url=${encodeURIComponent(t)}`,
  }
}

async function tryFetch(proxyUrl: string, extra?: Record<string, string>): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(proxyUrl, {
      signal: ctrl.signal,
      headers: { Accept: 'text/html,application/json,*/*', ...extra },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    if (!text || text.length < 24) throw new Error(`respuesta vacía (${text.length}b)`)
    return text
  } finally {
    clearTimeout(timer)
  }
}

/** Fetch a remote URL's body as text, transparently going through a proxy. */
export async function proxyFetch(target: string): Promise<string> {
  const backend = backendProxy()
  // Order: backend first (if any), then public proxies starting at `preferred`.
  const order: Proxy[] = []
  if (backend) order.push(backend)
  const attempts = Math.min(MAX_PUBLIC_ATTEMPTS, PUBLIC_PROXIES.length)
  for (let i = 0; i < attempts; i++) {
    order.push(PUBLIC_PROXIES[(preferred + i) % PUBLIC_PROXIES.length])
  }

  let lastErr: unknown
  for (const proxy of order) {
    const start = performance.now()
    try {
      let body = await tryFetch(proxy.build(target), proxy.headers)
      if (proxy.unwrap) body = proxy.unwrap(body)
      const ms = Math.round(performance.now() - start)
      logDebug({
        kind: 'fetch',
        ok: true,
        ms,
        label: `${proxy.name} ✓`,
        detail: `${body.length}b · ${shortUrl(target)}`,
        preview: body.replace(/\s+/g, ' ').slice(0, 280),
      })
      if (proxy.name !== 'backend') {
        preferred = PUBLIC_PROXIES.findIndex((p) => p.name === proxy.name)
      }
      return body
    } catch (err) {
      const ms = Math.round(performance.now() - start)
      lastErr = err
      logDebug({
        kind: 'fetch',
        ok: false,
        ms,
        label: `${proxy.name} ✗`,
        detail: `${String((err as Error).message || err)} · ${shortUrl(target)}`,
      })
    }
  }
  throw new Error(`Todos los proxies fallaron (${String(lastErr)})`)
}

function shortUrl(u: string): string {
  try {
    const x = new URL(u)
    return x.hostname + x.pathname.slice(0, 40)
  } catch {
    return u.slice(0, 50)
  }
}
