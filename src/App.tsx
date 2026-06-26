import { useEffect, useState } from 'react'
import type { SongDetail, SongSummary } from './sources/types'
import { fetchSong, searchAll, summaryFromUrl } from './sources'
import {
  getFavorites,
  getRecents,
  pushRecent,
  removeFavorite,
  type Favorite,
} from './lib/storage'
import { SearchBar } from './components/SearchBar'
import { ResultsList } from './components/ResultsList'
import { SongView } from './components/SongView'
import { DebugPanel } from './components/DebugPanel'

type Tab = 'search' | 'favorites'

export function App() {
  const [tab, setTab] = useState<Tab>('search')
  const [results, setResults] = useState<SongSummary[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [song, setSong] = useState<SongDetail | null>(null)
  const [loadingSong, setLoadingSong] = useState(false)

  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [recents, setRecents] = useState<SongSummary[]>([])
  const [showDebug, setShowDebug] = useState(false)

  const refreshLists = () => {
    setFavorites(getFavorites())
    setRecents(getRecents())
  }
  useEffect(refreshLists, [])

  async function handleSearch(q: string) {
    const query = q.trim()
    if (!query) return
    setError(null)

    // If the user pasted a song URL, open it directly.
    const fromUrl = summaryFromUrl(query)
    if (fromUrl) {
      openSong(fromUrl)
      return
    }

    setLoading(true)
    setSearched(true)
    setResults([])
    try {
      const res = await searchAll(query)
      setResults(res)
      if (res.length === 0) {
        setError('Sin resultados. Prueba con otro nombre o pega la URL de la canción.')
      }
    } catch (e) {
      setError(`Error buscando: ${String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  async function openSong(summary: SongSummary) {
    setLoadingSong(true)
    setError(null)
    try {
      const detail = await fetchSong(summary)
      setSong(detail)
      pushRecent({ ...summary, title: detail.title, artist: detail.artist })
      refreshLists()
      window.scrollTo(0, 0)
    } catch (e) {
      setError(
        `No se pudo cargar la canción (${String(e)}). Intenta otra versión o ábrela en el sitio original.`
      )
    } finally {
      setLoadingSong(false)
    }
  }

  function openFavorite(fav: Favorite) {
    setSong(fav)
    window.scrollTo(0, 0)
  }

  if (song) {
    return (
      <SongView
        song={song}
        onBack={() => {
          setSong(null)
          refreshLists()
        }}
      />
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-row">
          <h1 className="brand">🎸 Acordes</h1>
          <button
            className={`debug-btn ${showDebug ? 'on' : ''}`}
            onClick={() => setShowDebug((v) => !v)}
            type="button"
            aria-label="Diagnóstico"
            title="Diagnóstico"
          >
            🐞
          </button>
        </div>
        <nav className="tabs">
          <button className={tab === 'search' ? 'on' : ''} onClick={() => setTab('search')}>
            Buscar
          </button>
          <button className={tab === 'favorites' ? 'on' : ''} onClick={() => setTab('favorites')}>
            Favoritos {favorites.length ? `(${favorites.length})` : ''}
          </button>
        </nav>
      </header>

      {showDebug ? <DebugPanel onClose={() => setShowDebug(false)} /> : null}

      {loadingSong ? <div className="loading-bar">Cargando canción…</div> : null}

      {tab === 'search' ? (
        <main className="page">
          <SearchBar onSearch={handleSearch} loading={loading} />
          {error ? <p className="error">{error}</p> : null}

          {loading ? <p className="hint">Buscando en CifraClub y CIFRAS…</p> : null}

          {results.length > 0 ? (
            <ResultsList results={results} onPick={openSong} />
          ) : !searched && recents.length > 0 ? (
            <section>
              <h2 className="section-title">Recientes</h2>
              <ResultsList results={recents} onPick={openSong} />
            </section>
          ) : !searched ? (
            <Welcome />
          ) : null}
        </main>
      ) : (
        <main className="page">
          {favorites.length === 0 ? (
            <p className="hint">
              Aún no tienes favoritos. Abre una canción y toca el corazón ♡ para
              guardarla (funciona sin conexión).
            </p>
          ) : (
            <ul className="results">
              {favorites.map((f) => (
                <li key={f.id}>
                  <div className="result fav-row">
                    <button className="result-main" onClick={() => openFavorite(f)} type="button">
                      <span className="result-title">{f.title}</span>
                      {f.artist ? <span className="result-artist">{f.artist}</span> : null}
                    </button>
                    <button
                      className="del"
                      aria-label="Eliminar favorito"
                      onClick={() => {
                        removeFavorite(f.id)
                        refreshLists()
                      }}
                      type="button"
                    >
                      🗑
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </main>
      )}
    </div>
  )
}

function Welcome() {
  return (
    <div className="welcome">
      <p>Busca cualquier canción y obtén su letra con acordes — sin publicidad.</p>
      <ul>
        <li>🔎 Trae automáticamente la versión mejor calificada.</li>
        <li>🎚️ Transpón de tono y ajusta el tamaño de letra.</li>
        <li>🎸 Mira los diagramas de cada acorde.</li>
        <li>📜 Auto-scroll manos libres mientras tocas.</li>
        <li>♥ Guarda favoritos (disponibles sin conexión).</li>
      </ul>
      <p className="hint">
        Tip: también puedes pegar el enlace de una canción de CifraClub o
        Ultimate Guitar.
      </p>
    </div>
  )
}
