import { useMemo, useState } from 'react'
import type { SongSummary } from '../sources/types'
import { sourceLabel } from '../sources'
import { fold } from '../lib/html'
import { clearRecents, getFavorites, getRecents, removeFavorite, removeRecent, restoreFavorite } from '../lib/storage'
import { useStorageVersion } from '../hooks/useStores'
import { Icon } from './Icon'
import { Avatar } from './SearchPage'
import { Segmented } from './SongModals'
import { toast } from './Toast'

interface Props {
  onOpen: (s: SongSummary) => void
}

export function LibraryPage({ onOpen }: Props) {
  const v = useStorageVersion()
  const [tab, setTab] = useState<'favs' | 'recent'>('favs')
  const [filter, setFilter] = useState('')
  const favorites = useMemo(() => getFavorites(), [v])
  const recents = useMemo(() => getRecents(), [v])

  const list: SongSummary[] = tab === 'favs' ? favorites : recents
  const f = fold(filter.trim())
  const shown = f ? list.filter((s) => fold(`${s.title} ${s.artist}`).includes(f)) : list

  const remove = (s: SongSummary) => {
    if (tab === 'favs') {
      const fav = favorites.find((x) => x.id === s.id)
      removeFavorite(s.id)
      if (fav) toast('Quitada de favoritos', { label: 'Deshacer', run: () => restoreFavorite(fav) })
    } else removeRecent(s.id)
  }

  return (
    <div className="page library-page">
      <header className="page-header">
        <div className="brand">Biblioteca</div>
        <Segmented
          value={tab}
          options={[
            ['favs', `Favoritos${favorites.length ? ` (${favorites.length})` : ''}`],
            ['recent', 'Recientes'],
          ]}
          onChange={setTab}
        />
        {list.length > 6 ? (
          <div className="searchbar small">
            <Icon name="search" size={18} className="searchbar-icon" />
            <input
              type="search"
              placeholder="Filtrar…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filtrar canciones"
            />
          </div>
        ) : null}
      </header>
      <main className="page-body">
        {list.length === 0 ? (
          <div className="state-card">
            {tab === 'favs' ? (
              <p>
                Aún no tienes favoritos. Abre una canción y toca <Icon name="heart" size={16} /> para guardarla: queda
                disponible sin conexión, con tu tono y cejilla.
              </p>
            ) : (
              <p>Las canciones que abras aparecerán aquí.</p>
            )}
          </div>
        ) : (
          <ul className="results compact">
            {shown.map((s) => (
              <li key={s.id} className="lib-row">
                <button className="result-main" type="button" onClick={() => onOpen(s)}>
                  <Avatar title={s.title} thumb={s.thumb} />
                  <span className="result-text">
                    <span className="result-title">{s.title}</span>
                    <span className="result-artist">
                      {s.artist}
                      <span className="dot-sep">·</span>
                      {sourceLabel(s.source)}
                      {s.key ? (
                        <>
                          <span className="dot-sep">·</span>
                          {s.key}
                        </>
                      ) : null}
                    </span>
                  </span>
                </button>
                <button className="icon-btn ghost" type="button" aria-label={`Quitar ${s.title}`} onClick={() => remove(s)}>
                  <Icon name={tab === 'favs' ? 'trash' : 'x'} size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {tab === 'recent' && recents.length > 0 ? (
          <button className="btn subtle" type="button" onClick={() => clearRecents()}>
            Borrar historial
          </button>
        ) : null}
      </main>
    </div>
  )
}
