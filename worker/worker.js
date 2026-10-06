/**
 * Acordes — proxy backend (Cloudflare Worker)
 *
 * A small CORS proxy that fetches chord sites server-side with browser-like
 * headers (User-Agent, Referer, X-Requested-With), which public CORS
 * proxies can't send. It only proxies an allowlist of hosts.
 *
 * Usage from the app:  GET https://<worker-url>/?url=<encoded target URL>
 *   &ua=mobile   use an iPhone User-Agent instead of desktop Chrome
 *   ?ping        health check → {"ok":true,"version":2}
 *
 * v2 changes:
 *  - Desktop User-Agent by default (Ultimate Guitar returns its JSON data
 *    only to desktop browsers).
 *  - Upstream 3xx responses that carry a page (UG does this) are returned
 *    as 200 so browsers don't treat them as errors.
 *  - Edge cache: searches 15 min, song pages 6 h. Faster repeats and fewer
 *    hits to the sites.
 *  - m.lacuerda.net allowed (LaCuerda's search API).
 *
 * Note: CifraClub song pages are behind Akamai, which blocks Cloudflare's
 * IPs; the app automatically falls back to r.jina.ai for those.
 *
 * Deploy: see worker/README.md. Free tier is plenty for personal use.
 */

const VERSION = 2

// Only these hosts may be proxied (prevents abuse as an open proxy).
const ALLOWED = [
  'cifraclub.com.br',
  'www.cifraclub.com.br',
  'cifraclub.com',
  'www.cifraclub.com',
  'solr.sscdn.co',
  'ultimate-guitar.com',
  'www.ultimate-guitar.com',
  'tabs.ultimate-guitar.com',
  'tusacordes.com',
  'www.tusacordes.com',
  'lacuerda.net',
  'www.lacuerda.net',
  'acordes.lacuerda.net',
  'chords.lacuerda.net',
  'm.lacuerda.net',
  'cifras.com.br',
  'www.cifras.com.br',
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
]

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'X-Proxy-Status, X-Worker-Version, X-Cache',
}

/** The right Referer per host so anti-hotlinking endpoints answer. */
function refererFor(host) {
  if (host.includes('sscdn') || host.includes('cifraclub')) return 'https://www.cifraclub.com.br/'
  if (host.includes('ultimate-guitar')) return 'https://www.ultimate-guitar.com/'
  if (host.includes('tusacordes')) return 'https://www.tusacordes.com/'
  if (host.includes('lacuerda')) return 'https://acordes.lacuerda.net/'
  if (host.includes('cifras.com')) return 'https://www.cifras.com.br/'
  if (host.includes('youtube')) return 'https://www.youtube.com/'
  return undefined
}

/** Searches change often; song pages hardly ever. */
function cacheSeconds(url) {
  const s = url.hostname + url.pathname
  if (/solr\.sscdn|search|buscar|busca|iapp\.php|results/.test(s)) return 15 * 60
  return 6 * 3600
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

    const reqUrl = new URL(request.url)
    if (reqUrl.searchParams.has('ping')) return json({ ok: true, version: VERSION }, 200)

    const target = reqUrl.searchParams.get('url')
    if (!target) return json({ ok: false, error: 'Falta el parámetro ?url=' }, 400)

    let t
    try {
      t = new URL(target)
    } catch {
      return json({ ok: false, error: 'URL inválida' }, 400)
    }
    if (!ALLOWED.includes(t.hostname)) {
      return json({ ok: false, error: `Host no permitido: ${t.hostname}` }, 403)
    }

    const mobile = reqUrl.searchParams.get('ua') === 'mobile'
    const cache = caches.default
    const cacheKey = new Request(`https://cache.acordes/${mobile ? 'm' : 'd'}/${t.href}`)
    const hit = await cache.match(cacheKey)
    if (hit) {
      const res = new Response(hit.body, hit)
      res.headers.set('X-Cache', 'HIT')
      return res
    }

    const headers = {
      'User-Agent': mobile ? MOBILE_UA : DESKTOP_UA,
      Accept: 'text/html,application/json,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8,pt;q=0.7',
      // Some sites (e.g. CIFRAS' /api/search) only answer to XHR-style requests.
      'X-Requested-With': 'XMLHttpRequest',
    }
    const ref = refererFor(t.hostname)
    if (ref) headers.Referer = ref

    let upstream
    try {
      upstream = await fetch(t.href, { headers, redirect: 'follow' })
    } catch (err) {
      return json({ ok: false, error: 'Fallo al obtener: ' + String(err) }, 502)
    }

    const body = await upstream.arrayBuffer()
    // A 3xx that reaches us (redirects are followed) is a page sent with an
    // odd status; serve it as 200 so the browser doesn't reject it.
    const status = upstream.status >= 300 && upstream.status < 400 && body.byteLength > 0 ? 200 : upstream.status
    const res = new Response(body, {
      status,
      headers: {
        ...CORS,
        'Content-Type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8',
        'X-Proxy-Status': String(upstream.status),
        'X-Worker-Version': String(VERSION),
        'X-Cache': 'MISS',
        'Cache-Control': `public, max-age=${status === 200 ? cacheSeconds(t) : 0}`,
      },
    })
    if (status === 200 && body.byteLength > 512) {
      ctx.waitUntil(cache.put(cacheKey, res.clone()))
    }
    return res
  },
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'X-Worker-Version': String(VERSION) },
  })
}
