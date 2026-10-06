import { useSyncExternalStore } from 'react'

/**
 * Tiny hash router. Hash URLs work on GitHub Pages without server rewrites
 * and make every screen addressable: the back gesture/button works, and a
 * song link (#/cancion?u=…) opens straight in the app — that's what Share
 * sends.
 */

export type Route =
  | { name: 'search'; q?: string }
  | { name: 'library' }
  | { name: 'settings' }
  | { name: 'song'; url: string }

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  const [path, query = ''] = h.split('?')
  const params = new URLSearchParams(query)
  switch (path) {
    case 'cancion': {
      const url = params.get('u')
      return url ? { name: 'song', url } : { name: 'search' }
    }
    case 'biblioteca':
      return { name: 'library' }
    case 'ajustes':
      return { name: 'settings' }
    default:
      return { name: 'search', q: params.get('q') || undefined }
  }
}

export function routeHash(route: Route): string {
  switch (route.name) {
    case 'song':
      return `#/cancion?u=${encodeURIComponent(route.url)}`
    case 'library':
      return '#/biblioteca'
    case 'settings':
      return '#/ajustes'
    default:
      return route.q ? `#/?q=${encodeURIComponent(route.q)}` : '#/'
  }
}

/** Absolute link to a song inside the app (for sharing). */
export function songShareUrl(url: string): string {
  return `${location.origin}${location.pathname}${routeHash({ name: 'song', url })}`
}

const listeners = new Set<() => void>()
let current = typeof location !== 'undefined' ? location.hash : ''

function update() {
  if (location.hash === current) return
  current = location.hash
  listeners.forEach((l) => l())
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', update)
  window.addEventListener('hashchange', update)
  if (history.state?.depth == null) history.replaceState({ depth: 0 }, '')
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => current)
  return parseHash(hash)
}

export function navigate(route: Route, opts: { replace?: boolean } = {}) {
  const hash = routeHash(route)
  if (hash === location.hash || (hash === '#/' && !location.hash)) return
  const depth = (history.state?.depth as number | undefined) ?? 0
  if (opts.replace) history.replaceState({ depth }, '', hash)
  else history.pushState({ depth: depth + 1 }, '', hash)
  update()
}

/** Go back inside the app; if we arrived from outside, go to `fallback`. */
export function goBack(fallback: Route = { name: 'search' }) {
  if (((history.state?.depth as number | undefined) ?? 0) > 0) history.back()
  else navigate(fallback, { replace: true })
}
