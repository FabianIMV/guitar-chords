import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetForTests, detectBlock, fetchText, getRouteHealth } from '../src/lib/proxy'

type Handler = (url: string, init?: RequestInit) => Promise<Response> | Response

function mockFetch(handler: Handler) {
  const calls: string[] = []
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    calls.push(url)
    return new Promise<Response>((resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const e = new Error('aborted')
        e.name = 'AbortError'
        reject(e)
      })
      Promise.resolve(handler(url, init)).then(resolve, reject)
    })
  })
  return calls
}

const PAGE = '<html><head><title>Song</title></head><body><pre>[Intro] <b>Am</b></pre></body></html>'
const BLOCK = '<html><head><title>Access Denied</title></head><body>no</body></html>'

beforeEach(() => {
  __resetForTests()
  localStorage.clear()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('detectBlock', () => {
  it('spots block pages and worker errors', () => {
    expect(detectBlock(BLOCK)).toMatch(/bloqueo/)
    expect(detectBlock('<title>Just a moment...</title>' + 'x'.repeat(50))).toMatch(/bloqueo/)
    expect(detectBlock('{"ok":false,"error":"Host no permitido: x.com"}')).toBe('Host no permitido: x.com')
    expect(detectBlock('error code: 522')).toBeTruthy()
    expect(detectBlock(PAGE)).toBeNull()
  })
})

describe('fetchText', () => {
  it('falls through to Jina when the backend gets a block page, and remembers it', async () => {
    const calls = mockFetch((url) =>
      url.includes('workers.dev')
        ? new Response(BLOCK, { status: 403 })
        : new Response(PAGE, { status: 200 })
    )
    const body = await fetchText('https://www.cifraclub.com.br/a/b/', {
      validate: (b) => (b.includes('<pre') ? null : 'sin <pre>'),
    })
    expect(body).toBe(PAGE)
    expect(calls[0]).toContain('workers.dev')
    expect(calls[1]).toContain('r.jina.ai')

    // Second request to the same host starts with Jina directly.
    calls.length = 0
    await fetchText('https://www.cifraclub.com.br/c/d/', {
      validate: (b) => (b.includes('<pre') ? null : 'sin <pre>'),
    })
    expect(calls[0]).toContain('r.jina.ai')
    expect(getRouteHealth().some((h) => h.key === 'cifraclub.com.br|backend' && h.fail > 0)).toBe(true)
  })

  it('accepts a backend 3xx that carries the page (Ultimate Guitar quirk)', async () => {
    const calls = mockFetch(() => new Response(PAGE, { status: 302 }))
    const body = await fetchText('https://tabs.ultimate-guitar.com/tab/x')
    expect(body).toBe(PAGE)
    expect(calls).toHaveLength(1)
  })

  it('rejects bodies that fail validation and tries the next route', async () => {
    const calls = mockFetch((url) =>
      url.includes('workers.dev')
        ? new Response('<html><title>Home</title><body>wrong page, no chords here</body></html>')
        : new Response(PAGE)
    )
    const body = await fetchText('https://example.com/song', {
      validate: (b) => (b.includes('<pre') ? null : 'sin <pre>'),
    })
    expect(body).toBe(PAGE)
    expect(calls.length).toBe(2)
  })

  it('hedges a slow route by starting the next one', async () => {
    vi.useFakeTimers()
    const calls = mockFetch((url) =>
      url.includes('workers.dev')
        ? new Promise<Response>(() => {}) // never answers
        : new Response(PAGE)
    )
    const p = fetchText('https://lacuerda.net/x')
    await vi.advanceTimersByTimeAsync(3600)
    await expect(p).resolves.toBe(PAGE)
    expect(calls[1]).toContain('r.jina.ai')
  })

  it('sends Jina the format and selector', async () => {
    let headers: Record<string, string> = {}
    mockFetch((url, init) => {
      if (url.includes('workers.dev')) return new Response('', { status: 500 })
      headers = (init?.headers ?? {}) as Record<string, string>
      return new Response(PAGE)
    })
    await fetchText('https://site.com/p', { select: 'pre, h1' })
    expect(headers['X-Return-Format']).toBe('html')
    expect(headers['X-Target-Selector']).toBe('pre, h1')
  })

  it('reports every failed route', async () => {
    mockFetch(() => new Response('nope', { status: 500 }))
    await expect(fetchText('https://site.com/q')).rejects.toThrow(/backend: HTTP 500.*jina: HTTP 500/)
  })

  it('de-duplicates identical in-flight requests and caches when asked', async () => {
    const calls = mockFetch(() => new Response(PAGE))
    const [a, b] = await Promise.all([
      fetchText('https://site.com/same', { cacheMs: 1000 }),
      fetchText('https://site.com/same', { cacheMs: 1000 }),
    ])
    expect(a).toBe(b)
    expect(calls).toHaveLength(1)
    await fetchText('https://site.com/same', { cacheMs: 1000 })
    expect(calls).toHaveLength(1)
  })

  it('aborts for the caller without breaking others', async () => {
    mockFetch(() => new Promise<Response>((r) => setTimeout(() => r(new Response(PAGE)), 50)))
    const ctrl = new AbortController()
    const p = fetchText('https://site.com/slow', { signal: ctrl.signal })
    ctrl.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
  })
})
