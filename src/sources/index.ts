import type { ChordSource, RequestOptions, SongDetail, SongSummary, SourceId } from './types'
import { cifraclub } from './cifraclub'
import { ultimateGuitar } from './ultimateGuitar'
import { tusacordes } from './tusacordes'
import { lacuerda } from './lacuerda'
import { cifras } from './cifras'
import { logDebug } from '../lib/debug'
import { getPrefs } from '../lib/settings'
import { prettifySlug } from '../lib/html'
import { isAbort } from '../lib/proxy'

/** Every adapter (pasted URLs work for all of them). */
export const SOURCES: Record<SourceId, ChordSource> = {
  cifraclub,
  'ultimate-guitar': ultimateGuitar,
  lacuerda,
  tusacordes,
  cifras,
}

/**
 * Sources that can be searched. CIFRAS is parked (its song pages are behind
 * a Cloudflare challenge, so its results could never be opened).
 */
export const SEARCHABLE: SourceId[] = ['cifraclub', 'ultimate-guitar', 'lacuerda', 'tusacordes']

export function sourceLabel(id: SourceId): string {
  return SOURCES[id]?.label ?? id
}

/** Hard cap so one slow source can never hold the search. */
const SEARCH_TIMEOUT_MS = 16000

export interface SourceStatus {
  id: SourceId
  label: string
  state: 'loading' | 'done' | 'error'
  count: number
  error?: string
  ms?: number
}

export interface SearchProgress {
  results: SongSummary[]
  statuses: SourceStatus[]
  done: boolean
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`sin respuesta en ${ms / 1000}s`)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      }
    )
  })
}

/**
 * Search the enabled sources in parallel. `onProgress` fires every time a
 * source answers, so the UI can show results as they arrive instead of
 * waiting for the slowest site.
 */
export async function searchAll(
  query: string,
  opts: RequestOptions & { onProgress?: (p: SearchProgress) => void } = {}
): Promise<SearchProgress> {
  const q = query.trim()
  const enabled = getPrefs().sources.filter((id) => SEARCHABLE.includes(id))
  const statuses: SourceStatus[] = enabled.map((id) => ({
    id,
    label: sourceLabel(id),
    state: 'loading',
    count: 0,
  }))
  const results: SongSummary[] = []
  const snapshot = (done: boolean): SearchProgress => ({
    results: results.slice(),
    statuses: statuses.map((s) => ({ ...s })),
    done,
  })
  if (!q || enabled.length === 0) return snapshot(true)

  logDebug({ kind: 'info', label: `Buscando "${q}" en ${enabled.length} fuentes…` })
  opts.onProgress?.(snapshot(false))

  await Promise.all(
    enabled.map(async (id, i) => {
      const start = performance.now()
      try {
        const found = await withTimeout(SOURCES[id].search(q, { signal: opts.signal }), SEARCH_TIMEOUT_MS)
        results.push(...found)
        statuses[i] = { ...statuses[i], state: 'done', count: found.length }
        logDebug({ kind: 'source', ok: found.length > 0, label: `${sourceLabel(id)}: ${found.length} resultados` })
      } catch (e) {
        if (isAbort(e)) throw e
        const msg = String((e as Error)?.message || e)
        statuses[i] = { ...statuses[i], state: 'error', error: msg }
        logDebug({ kind: 'source', ok: false, label: `${sourceLabel(id)}: error`, detail: msg })
      }
      statuses[i].ms = Math.round(performance.now() - start)
      if (!opts.signal?.aborted) opts.onProgress?.(snapshot(false))
    })
  )
  const final = snapshot(true)
  if (!opts.signal?.aborted) opts.onProgress?.(final)
  return final
}

/* ---- Song fetching (with background prefetch) ---- */

const prefetched = new Map<string, Promise<SongDetail>>()

export function fetchSong(summary: SongSummary, opts: RequestOptions = {}): Promise<SongDetail> {
  const pre = prefetched.get(summary.id)
  if (pre) {
    prefetched.delete(summary.id)
    return pre.catch(() => fetchSong(summary, opts))
  }
  const source = SOURCES[summary.source]
  if (!source) return Promise.reject(new Error(`Fuente desconocida: ${summary.source}`))
  return source.fetchSong(summary, opts)
}

/** Start loading a song we expect the user to open (top search result). */
export function prefetchSong(summary: SongSummary) {
  if (prefetched.has(summary.id)) return
  const source = SOURCES[summary.source]
  if (!source) return
  const p = source.fetchSong(summary)
  p.catch(() => prefetched.delete(summary.id))
  prefetched.set(summary.id, p)
  if (prefetched.size > 4) prefetched.delete(prefetched.keys().next().value as string)
}

/* ---- Pasted URLs ---- */

function sourceForHost(host: string): SourceId | null {
  const h = host.replace(/^www\./, '')
  for (const id of Object.keys(SOURCES) as SourceId[]) {
    if (SOURCES[id].hosts.some((x) => h === x || h.endsWith('.' + x))) return id
  }
  return null
}

/** Detect a pasted song URL and turn it into a fetchable summary. */
export function summaryFromUrl(input: string): SongSummary | null {
  const text = input.trim()
  if (!/^https?:\/\//i.test(text)) return null
  let u: URL
  try {
    u = new URL(text)
  } catch {
    return null
  }
  const source = sourceForHost(u.hostname)
  if (!source) return null
  const parts = u.pathname.split('/').filter(Boolean)
  let title = parts[parts.length - 1] ?? 'Canción'
  let artist = parts.length >= 2 ? parts[parts.length - 2] : ''
  title = title
    .replace(/\.s?html?$/, '')
    .replace(/-(chords|tabs?|acordes)-\d+$/, '')
    .replace(/-\d+$/, '')
  if (artist === 'tab') artist = ''
  return {
    id: `${source === 'ultimate-guitar' ? 'ug' : source}:${u.href}`,
    source,
    title: prettifySlug(title) || 'Canción',
    artist: prettifySlug(artist),
    url: u.href,
    score: 1,
  }
}
