/**
 * Acordes — proxy backend (Cloudflare Worker)
 *
 * A tiny CORS proxy that fetches chord sites server-side WITH the correct
 * Referer/User-Agent headers. This is what public CORS proxies can't do, and
 * it's why CifraClub's search (solr.sscdn.co) and Ultimate Guitar return data
 * here but not through generic proxies.
 *
 * Usage from the app:  GET https://<worker-url>/?url=<encoded target URL>
 * Paste the worker URL into the app's Debug panel → "Backend propio".
 *
 * Deploy: see worker/README.md (copy/paste into the Cloudflare dashboard, or
 * `npx wrangler deploy`). Free tier is plenty for personal use.
 */

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
  'cifras.com.br',
  'www.cifras.com.br',
]

const BROWSER_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
}

/** The right Referer per host so anti-hotlinking endpoints answer. */
function refererFor(host) {
  if (host.includes('sscdn') || host.includes('cifraclub'))
    return 'https://www.cifraclub.com.br/'
  if (host.includes('ultimate-guitar')) return 'https://www.ultimate-guitar.com/'
  if (host.includes('tusacordes')) return 'https://www.tusacordes.com/'
  if (host.includes('lacuerda')) return 'https://acordes.lacuerda.net/'
  if (host.includes('cifras.com')) return 'https://www.cifras.com.br/'
  return undefined
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    const reqUrl = new URL(request.url)
    const target = reqUrl.searchParams.get('url')
    if (!target) {
      return json(
        { ok: false, error: 'Falta el parámetro ?url=' },
        400
      )
    }

    let t
    try {
      t = new URL(target)
    } catch {
      return json({ ok: false, error: 'URL inválida' }, 400)
    }

    if (!ALLOWED.includes(t.hostname)) {
      return json({ ok: false, error: `Host no permitido: ${t.hostname}` }, 403)
    }

    const headers = {
      'User-Agent': BROWSER_UA,
      Accept: 'text/html,application/json,application/xhtml+xml,*/*',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8,pt;q=0.7',
    }
    const ref = refererFor(t.hostname)
    if (ref) headers.Referer = ref

    try {
      const upstream = await fetch(t.href, { headers, redirect: 'follow' })
      const body = await upstream.arrayBuffer()
      const ct = upstream.headers.get('content-type') || 'text/plain; charset=utf-8'
      return new Response(body, {
        status: upstream.status,
        headers: { ...CORS, 'Content-Type': ct, 'X-Proxy-Status': String(upstream.status) },
      })
    } catch (err) {
      return json({ ok: false, error: 'Fallo al obtener: ' + String(err) }, 502)
    }
  },
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
