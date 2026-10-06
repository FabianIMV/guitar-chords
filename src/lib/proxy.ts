/**
 * Fetch layer. GitHub Pages is static, so the browser cannot fetch the chord
 * sites directly (no CORS headers; several also block datacenter IPs or
 * need specific headers). Every request goes through one of these routes:
 *
 *  1. backend — the user's own Cloudflare Worker (see worker/): fast, sends
 *     the right Referer/User-Agent, works for most sites.
 *  2. jina    — r.jina.ai renders pages with a real browser. Slower, but it
 *     gets through Akamai/Cloudflare walls the Worker can't (CifraClub song
 *     pages). It can also return only the elements we need
 *     (X-Target-Selector), which cuts a 500 KB page down to ~30 KB.
 *  3. public CORS proxies as a last resort.
 *
 * What makes it reliable:
 *  - Content validation: a 200 response can still be a block page
 *    ("Access Denied", "Just a moment…") or the wrong page; each request can
 *    pass a validator and the next route is tried.
 *  - Per-host route memory: if the Worker gets 403 from a host, the next
 *    request to that host starts with the route that worked (persisted).
 *  - Hedging: if the first route is slow, the next one starts in parallel
 *    and the first valid answer wins (the rest are aborted).
 *  - In-flight de-duplication and a short in-memory cache.
 *
 * Every attempt is recorded in the in-app debug log.
 */

import { logDebug } from './debug'
import { getBackendUrl } from './settings'

export interface FetchOptions {
  /** 'html' for pages, 'text' for JSON/JS endpoints (affects Jina). */
  as?: 'html' | 'text'
  /** CSS selector so Jina returns only the matching elements. */
  select?: string
  /** Return an error message if the body isn't what we need. */
  validate?: (body: string) => string | null | undefined
  signal?: AbortSignal
  /** Keep successful bodies in memory this long. */
  cacheMs?: number
}

interface Route {
  name: string
  url: (target: string) => string
  headers?: (opts: FetchOptions) => Record<string, string>
  unwrap?: (raw: string) => string
  timeoutMs: number
  acceptStatus?: (status: number) => boolean
}

const JINA: Route = {
  name: 'jina',
  url: (t) => `https://r.jina.ai/${t}`,
  headers: (o) => {
    const h: Record<string, string> = {
      'X-Return-Format': o.as === 'text' ? 'text' : 'html',
    }
    if (o.select && o.as !== 'text') h['X-Target-Selector'] = o.select
    return h
  },
  timeoutMs: 15000,
}

const PUBLIC: Route[] = [
  {
    name: 'allorigins',
    url: (t) => `https://api.allorigins.win/raw?url=${encodeURIComponent(t)}`,
    timeoutMs: 8000,
  },
  {
    name: 'codetabs',
    url: (t) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(t)}`,
    timeoutMs: 8000,
  },
]

function backendRoute(): Route | null {
  const base = getBackendUrl()
  if (!base) return null
  const sep = base.includes('?') ? '&' : '?'
  return {
    name: 'backend',
    url: (t) => `${base}${sep}url=${encodeURIComponent(t)}`,
    timeoutMs: 10000,
    // Some sites answer a real page with a 3xx status (Ultimate Guitar
    // does); older Worker versions pass that status through. The body is
    // what matters — validation decides.
    acceptStatus: (s) => s >= 200 && s < 400,
  }
}

/* ------------------------------------------------------------------ */
/* Block-page detection                                                */
/* ------------------------------------------------------------------ */

export function detectBlock(body: string): string | null {
  if (body.length < 24) return `respuesta vacía (${body.length}b)`
  const head = body.slice(0, 3000)
  const title = head.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim() ?? ''
  if (/^(access denied|just a moment|attention required|please wait|checking your browser|403 forbidden|404 not found|502 bad gateway)/i.test(title)) {
    return `página de bloqueo ("${title.slice(0, 40)}")`
  }
  const workerErr = head.match(/^\s*\{\s*"ok"\s*:\s*false\s*,\s*"error"\s*:\s*"([^"]*)"/)
  if (workerErr) return workerErr[1]
  if (/^\s*error code: \d+/i.test(head)) return head.trim().slice(0, 30)
  return null
}

/* ------------------------------------------------------------------ */
/* Per-host route health                                               */
/* ------------------------------------------------------------------ */

interface Stat {
  ok: number
  fail: number
  ms: number // average latency of successes
  t: number // last update
}

const HEALTH_KEY = 'gc.routeHealth.v1'
const HEALTH_TTL = 12 * 3600 * 1000
let health: Record<string, Stat> = loadHealth()
let saveTimer: ReturnType<typeof setTimeout> | undefined

function loadHealth(): Record<string, Stat> {
  try {
    const raw = JSON.parse(localStorage.getItem(HEALTH_KEY) || '{}') as Record<string, Stat>
    const now = Date.now()
    for (const k of Object.keys(raw)) if (now - raw[k].t > HEALTH_TTL) delete raw[k]
    return raw
  } catch {
    return {}
  }
}

function saveHealth() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(HEALTH_KEY, JSON.stringify(health))
    } catch {
      /* ignore */
    }
  }, 500)
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function record(host: string, route: string, ok: boolean, ms: number) {
  const k = `${host}|${route}`
  const s = health[k] ?? { ok: 0, fail: 0, ms: 0, t: 0 }
  if (ok) {
    s.ms = s.ok ? Math.round(s.ms * 0.6 + ms * 0.4) : ms
    s.ok++
  } else s.fail++
  // Forget slowly so a route can recover.
  if (s.ok + s.fail > 12) {
    s.ok /= 2
    s.fail /= 2
  }
  s.t = Date.now()
  health[k] = s
  saveHealth()
}

function routeScore(host: string, route: string): number {
  const s = health[`${host}|${route}`]
  if (!s || Date.now() - s.t > HEALTH_TTL) return 0.5
  return (s.ok + 1) / (s.ok + s.fail + 2)
}

function routeLatency(host: string, route: string): number | undefined {
  const s = health[`${host}|${route}`]
  return s && s.ok >= 1 ? s.ms : undefined
}

/** Routes for a target, best first for its host. */
function orderedRoutes(target: string): Route[] {
  const host = hostOf(target)
  const base: Route[] = []
  const backend = backendRoute()
  if (backend) base.push(backend)
  base.push(JINA, ...PUBLIC)
  return base
    .map((r, i) => ({ r, i, s: routeScore(host, r.name) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.r)
}

/** For the debug panel: what we've learned per host. */
export function getRouteHealth(): Array<{ key: string } & Stat> {
  return Object.entries(health)
    .map(([key, s]) => ({ key, ...s }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

export function resetRouteHealth() {
  health = {}
  saveHealth()
}

/* ------------------------------------------------------------------ */
/* Fetching                                                            */
/* ------------------------------------------------------------------ */

export class FetchError extends Error {
  constructor(message: string, public attempts: string[] = []) {
    super(message)
    this.name = 'FetchError'
  }
}

function abortError(): Error {
  const e = new Error('Cancelado')
  e.name = 'AbortError'
  return e
}

export function isAbort(e: unknown): boolean {
  return (e as Error)?.name === 'AbortError'
}

async function attempt(
  route: Route,
  target: string,
  opts: FetchOptions,
  signal: AbortSignal
): Promise<string> {
  const ctrl = new AbortController()
  let timedOut = false
  const onAbort = () => ctrl.abort()
  signal.addEventListener('abort', onAbort)
  const timer = setTimeout(() => {
    timedOut = true
    ctrl.abort()
  }, route.timeoutMs)
  try {
    const res = await fetch(route.url(target), {
      signal: ctrl.signal,
      headers: route.headers?.(opts),
    })
    const okStatus = route.acceptStatus ? route.acceptStatus(res.status) : res.ok
    if (!okStatus) throw new Error(`HTTP ${res.status}`)
    let body = await res.text()
    if (route.unwrap) body = route.unwrap(body)
    const blocked = detectBlock(body)
    if (blocked) throw new Error(blocked)
    const invalid = opts.validate?.(body)
    if (invalid) throw new Error(invalid)
    return body
  } catch (e) {
    if (timedOut) throw new Error(`timeout ${route.timeoutMs / 1000}s`)
    throw e
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', onAbort)
  }
}

const DEFAULT_HEDGE_MS = 3500

/**
 * Try routes in order; if one is slow, start the next in parallel. First
 * valid body wins. A failure immediately starts the next route.
 */
function race(target: string, opts: FetchOptions): Promise<string> {
  const host = hostOf(target)
  const routes = orderedRoutes(target)
  const short = shortUrl(target)

  return new Promise<string>((resolve, reject) => {
    const master = new AbortController()
    const errors: string[] = []
    let next = 0
    let pending = 0
    let settled = false
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined

    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(hedgeTimer)
      master.abort()
      fn()
    }

    const launch = () => {
      if (settled) return
      if (next >= routes.length) {
        if (pending === 0) {
          finish(() =>
            reject(new FetchError(`No se pudo obtener ${short} (${errors.join(' · ')})`, errors))
          )
        }
        return
      }
      const route = routes[next++]
      pending++
      const start = performance.now()
      attempt(route, target, opts, master.signal).then(
        (body) => {
          pending--
          const ms = Math.round(performance.now() - start)
          record(host, route.name, true, ms)
          logDebug({
            kind: 'fetch',
            ok: true,
            ms,
            label: `${route.name} ✓`,
            detail: `${body.length}b · ${short}`,
            preview: body.replace(/\s+/g, ' ').slice(0, 240),
          })
          finish(() => resolve(body))
        },
        (err) => {
          pending--
          if (settled) return // a sibling already won; ignore the abort
          const ms = Math.round(performance.now() - start)
          const msg = String((err as Error)?.message || err)
          record(host, route.name, false, ms)
          errors.push(`${route.name}: ${msg}`)
          logDebug({ kind: 'fetch', ok: false, ms, label: `${route.name} ✗`, detail: `${msg} · ${short}` })
          launch()
        }
      )
      // Hedge: if this one hasn't answered in time, start the next too.
      clearTimeout(hedgeTimer)
      const avg = routeLatency(host, route.name)
      const wait = avg ? Math.min(7000, Math.max(1500, avg * 2)) : DEFAULT_HEDGE_MS
      hedgeTimer = setTimeout(launch, wait)
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      reject(new FetchError('Sin conexión a internet'))
      return
    }
    launch()
  })
}

const memCache = new Map<string, { t: number; body: string }>()
const inFlight = new Map<string, Promise<string>>()

function withSignal<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p
  if (signal.aborted) return Promise.reject(abortError())
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError())
    signal.addEventListener('abort', onAbort, { once: true })
    p.then(
      (v) => {
        signal.removeEventListener('abort', onAbort)
        resolve(v)
      },
      (e) => {
        signal.removeEventListener('abort', onAbort)
        reject(e)
      }
    )
  })
}

/** Fetch a remote URL's body as text through the best available route. */
export function fetchText(target: string, opts: FetchOptions = {}): Promise<string> {
  const key = `${opts.as ?? 'html'}|${opts.select ?? ''}|${target}`
  if (opts.cacheMs) {
    const hit = memCache.get(key)
    if (hit && Date.now() - hit.t < opts.cacheMs) return Promise.resolve(hit.body)
  }
  let p = inFlight.get(key)
  if (!p) {
    p = race(target, opts)
      .then((body) => {
        if (opts.cacheMs) {
          memCache.set(key, { t: Date.now(), body })
          if (memCache.size > 40) memCache.delete(memCache.keys().next().value as string)
        }
        return body
      })
      .finally(() => inFlight.delete(key))
    inFlight.set(key, p)
  }
  return withSignal(p, opts.signal)
}

/** Backwards-compatible name. */
export const proxyFetch = (target: string) => fetchText(target)

export function shortUrl(u: string): string {
  try {
    const x = new URL(u)
    return x.hostname.replace(/^www\./, '') + x.pathname.slice(0, 40)
  } catch {
    return u.slice(0, 50)
  }
}

/** Test hook: forget caches and learned routes. */
export function __resetForTests() {
  memCache.clear()
  inFlight.clear()
  health = {}
}

export interface PingResult {
  ok: boolean
  version?: number
  ms: number
  error?: string
}

/** Check a backend Worker: reachable? which version? (v1 has no ?ping). */
export async function pingBackend(base: string): Promise<PingResult> {
  const sep = base.includes('?') ? '&' : '?'
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  const start = performance.now()
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}${sep}ping=1`, { signal: ctrl.signal })
    const body = await res.text()
    const ms = Math.round(performance.now() - start)
    if (res.ok) {
      const version = Number((JSON.parse(body) as { version?: number }).version) || 1
      return { ok: true, version, ms }
    }
    if (/Falta el parámetro/.test(body)) return { ok: true, version: 1, ms }
    return { ok: false, ms, error: `HTTP ${res.status}` }
  } catch (e) {
    return {
      ok: false,
      ms: Math.round(performance.now() - start),
      error: (e as Error)?.name === 'AbortError' ? 'sin respuesta' : String((e as Error)?.message || e),
    }
  } finally {
    clearTimeout(timer)
  }
}
