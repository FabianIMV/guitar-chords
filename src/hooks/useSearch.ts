import { useCallback, useMemo, useRef, useState } from 'react'
import { prefetchSong, searchAll, type SearchProgress } from '../sources'
import { groupResults } from '../lib/search'
import { isAbort } from '../lib/proxy'
import { pushSearchHistory } from '../lib/storage'

export interface SearchState {
  query: string
  progress: SearchProgress | null
  loading: boolean
  error: string | null
}

/**
 * Search state lives in App so going back from a song shows the same
 * results instantly. A new search aborts the previous one.
 */
export function useSearch() {
  const [state, setState] = useState<SearchState>({ query: '', progress: null, loading: false, error: null })
  const ctrlRef = useRef<AbortController | null>(null)

  const run = useCallback((q: string) => {
    const query = q.trim()
    ctrlRef.current?.abort()
    if (!query) {
      setState({ query: '', progress: null, loading: false, error: null })
      return
    }
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    pushSearchHistory(query)
    setState({ query, progress: null, loading: true, error: null })
    searchAll(query, {
      signal: ctrl.signal,
      onProgress: (progress) => setState((s) => (s.query === query ? { ...s, progress } : s)),
    })
      .then((final) => {
        if (ctrl.signal.aborted) return
        setState((s) => ({ ...s, progress: final, loading: false }))
        // Warm up the most likely tap so it opens instantly.
        const top = groupResults(query, final.results)[0]
        if (top) setTimeout(() => !ctrl.signal.aborted && prefetchSong(top.best), 300)
      })
      .catch((e) => {
        if (isAbort(e)) return
        setState((s) => ({ ...s, loading: false, error: String((e as Error)?.message || e) }))
      })
  }, [])

  const clear = useCallback(() => run(''), [run])

  const groups = useMemo(
    () => (state.progress ? groupResults(state.query, state.progress.results) : []),
    [state.progress, state.query]
  )

  return { ...state, groups, run, clear }
}
