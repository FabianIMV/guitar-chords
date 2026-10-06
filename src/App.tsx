import { useEffect } from 'react'
import type { SongSummary } from './sources/types'
import { navigate, useRoute } from './lib/router'
import { requestPersistence } from './lib/storage'
import { useSearch } from './hooks/useSearch'
import { usePrefs } from './hooks/useStores'
import { SearchPage } from './components/SearchPage'
import { LibraryPage } from './components/LibraryPage'
import { SettingsPage } from './components/SettingsPage'
import { SongView } from './components/SongView'
import { Icon } from './components/Icon'
import { ToastHost } from './components/Toast'

/**
 * Song hints: when a song is opened from search we already know its summary
 * and its sibling versions. The route only carries the URL (so links are
 * shareable); this registry keeps the extra context, with stable object
 * identity so the song view doesn't reload.
 */
const hints = new Map<string, { summary: SongSummary; versions?: SongSummary[] }>()

function openSong(summary: SongSummary, versions?: SongSummary[], replace = false) {
  const prev = hints.get(summary.url)
  if (!prev || prev.summary.id !== summary.id || prev.versions !== versions) {
    hints.set(summary.url, { summary, versions: versions ?? prev?.versions })
  }
  navigate({ name: 'song', url: summary.url }, { replace })
}

export function App() {
  const route = useRoute()
  const prefs = usePrefs()
  const search = useSearch()

  // Theme: explicit choice or follow the system.
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const dark =
        prefs.theme === 'dark' || (prefs.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.dataset.theme = dark ? 'dark' : 'light'
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1115' : '#f6f4f0')
    }
    apply()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [prefs.theme])

  // Ask once to keep our data (installed PWAs usually get it).
  useEffect(() => {
    requestPersistence()
  }, [])

  // A search query in the URL (#/?q=…) — e.g. after a reload.
  const routeQ = route.name === 'search' ? route.q : undefined
  useEffect(() => {
    if (routeQ && routeQ !== search.query) search.run(routeQ)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeQ])

  if (route.name === 'song') {
    return (
      <>
        <SongView
          key={route.url}
          url={route.url}
          hint={hints.get(route.url)}
          onOpenVersion={(s, versions) => openSong(s, versions, true)}
        />
        <ToastHost />
      </>
    )
  }

  return (
    <div className="app">
      {route.name === 'library' ? (
        <LibraryPage onOpen={(s) => openSong(s)} />
      ) : route.name === 'settings' ? (
        <SettingsPage />
      ) : (
        <SearchPage
          query={search.query}
          groups={search.groups}
          statuses={search.progress?.statuses ?? []}
          loading={search.loading}
          error={search.error}
          onSearch={(q) => {
            navigate({ name: 'search', q }, { replace: true })
            search.run(q)
          }}
          onClear={() => {
            navigate({ name: 'search' }, { replace: true })
            search.clear()
          }}
          onOpen={(s, versions) => openSong(s, versions)}
        />
      )}
      <nav className="bottom-nav" aria-label="Secciones">
        <button
          type="button"
          className={route.name === 'search' ? 'on' : ''}
          onClick={() => navigate({ name: 'search', q: search.query || undefined }, { replace: true })}
        >
          <Icon name="search" />
          <span>Buscar</span>
        </button>
        <button
          type="button"
          className={route.name === 'library' ? 'on' : ''}
          onClick={() => navigate({ name: 'library' }, { replace: true })}
        >
          <Icon name="library" />
          <span>Biblioteca</span>
        </button>
        <button
          type="button"
          className={route.name === 'settings' ? 'on' : ''}
          onClick={() => navigate({ name: 'settings' }, { replace: true })}
        >
          <Icon name="sliders" />
          <span>Ajustes</span>
        </button>
      </nav>
      <ToastHost />
    </div>
  )
}
