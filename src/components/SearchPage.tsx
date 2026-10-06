import { useEffect, useRef, useState } from 'react'
import type { SongSummary } from '../sources/types'
import type { SourceStatus } from '../sources'
import { sourceLabel, summaryFromUrl } from '../sources'
import type { SongGroup } from '../lib/search'
import { getRecents, getSearchHistory, removeSearchHistory } from '../lib/storage'
import { useStorageVersion } from '../hooks/useStores'
import { Icon } from './Icon'
import { formatCount } from './SongModals'

interface Props {
  query: string
  groups: SongGroup[]
  statuses: SourceStatus[]
  loading: boolean
  error: string | null
  onSearch: (q: string) => void
  onClear: () => void
  onOpen: (s: SongSummary, versions?: SongSummary[]) => void
}

export function SearchPage({ query, groups, statuses, loading, error, onSearch, onClear, onOpen }: Props) {
  const [value, setValue] = useState(query)
  const inputRef = useRef<HTMLInputElement>(null)
  useStorageVersion()
  useEffect(() => setValue(query), [query])

  const submit = (q: string) => {
    const fromUrl = summaryFromUrl(q)
    if (fromUrl) {
      onOpen(fromUrl)
      return
    }
    onSearch(q)
    inputRef.current?.blur()
  }

  const searched = !!query
  const anyDone = statuses.some((s) => s.state !== 'loading')
  const history = getSearchHistory()
  const recents = getRecents().slice(0, 8)

  return (
    <div className="page search-page">
      <header className="page-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <Icon name="note" size={20} />
          </span>
          Acordes
        </div>
        <form
          className="searchbar"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            submit(value)
          }}
        >
          <Icon name="search" size={20} className="searchbar-icon" />
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Canción, artista o enlace…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Buscar canción"
          />
          {value ? (
            <button
              type="button"
              className="icon-btn ghost"
              aria-label="Borrar búsqueda"
              onClick={() => {
                setValue('')
                onClear()
                inputRef.current?.focus()
              }}
            >
              <Icon name="x" size={18} />
            </button>
          ) : null}
        </form>
        {searched ? <SourceStatusRow statuses={statuses} /> : null}
      </header>

      <main className="page-body">
        {error ? <p className="state-card error-card">{error}</p> : null}

        {searched && groups.length > 0 ? (
          <ul className="results">
            {groups.map((g, i) => (
              <ResultCard key={g.key} group={g} top={i === 0} onOpen={onOpen} />
            ))}
          </ul>
        ) : null}

        {searched && groups.length === 0 && (loading || !anyDone) ? <ResultsSkeleton /> : null}

        {searched && !loading && groups.length === 0 && anyDone ? (
          <div className="state-card">
            <p>
              <strong>Sin resultados para “{query}”.</strong>
            </p>
            <p className="hint">Revisa la ortografía, prueba solo el título o pega el enlace de la canción.</p>
          </div>
        ) : null}

        {!searched ? (
          <>
            {history.length ? (
              <section>
                <h2 className="section-title">Búsquedas recientes</h2>
                <div className="chips-wrap">
                  {history.map((h) => (
                    <span className="chip chip-btn" key={h}>
                      <button type="button" onClick={() => submit(h)}>
                        <Icon name="clock" size={14} /> {h}
                      </button>
                      <button type="button" aria-label={`Quitar ${h}`} onClick={() => removeSearchHistory(h)}>
                        <Icon name="x" size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </section>
            ) : null}
            {recents.length ? (
              <section>
                <h2 className="section-title">Abiertas recientemente</h2>
                <ul className="results compact">
                  {recents.map((r) => (
                    <li key={r.id}>
                      <button className="result-main" type="button" onClick={() => onOpen(r)}>
                        <Avatar title={r.title} thumb={r.thumb} />
                        <span className="result-text">
                          <span className="result-title">{r.title}</span>
                          <span className="result-artist">
                            {r.artist}
                            <span className="dot-sep">·</span>
                            {sourceLabel(r.source)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {!history.length && !recents.length ? <Welcome /> : null}
          </>
        ) : null}
      </main>
    </div>
  )
}

function SourceStatusRow({ statuses }: { statuses: SourceStatus[] }) {
  return (
    <div className="source-status" aria-live="polite">
      {statuses.map((s) => (
        <span key={s.id} className={`src-chip ${s.state}`} title={s.error ?? (s.ms ? `${s.ms} ms` : undefined)}>
          {s.state === 'loading' ? <span className="spinner" /> : s.state === 'error' ? <Icon name="x" size={12} /> : null}
          {s.label}
          {s.state === 'done' ? <b>{s.count}</b> : null}
        </span>
      ))}
    </div>
  )
}

function ResultCard({ group, top, onOpen }: { group: SongGroup; top: boolean; onOpen: Props['onOpen'] }) {
  const [open, setOpen] = useState(false)
  const best = group.best
  const n = group.versions.length
  return (
    <li className={`result${top ? ' top' : ''}`}>
      <button className="result-main" type="button" onClick={() => onOpen(best, group.versions)}>
        <Avatar title={group.title} thumb={group.thumb} />
        <span className="result-text">
          <span className="result-title">{group.title}</span>
          <span className="result-artist">{group.artist}</span>
          <span className="result-meta">
            <span className={`src-badge src-${best.source}`}>{sourceLabel(best.source)}</span>
            {best.rating ? (
              <span className="rating">
                <Icon name="star" size={12} filled /> {best.rating.toFixed(1)}
                {best.votes ? <small>({formatCount(best.votes)})</small> : null}
              </span>
            ) : null}
            {best.key ? <span className="muted">Tono {best.key}</span> : null}
            {best.kind === 'tab' ? <span className="muted">Tablatura</span> : null}
          </span>
        </span>
        <Icon name="right" size={18} className="chev" />
      </button>
      {n > 1 ? (
        <button className="versions-toggle" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {n} versiones
          <Icon name={open ? 'up' : 'down'} size={16} />
        </button>
      ) : null}
      {open ? (
        <ul className="version-list inline">
          {group.versions.map((v, i) => (
            <li key={v.id}>
              <button type="button" className="version-row" onClick={() => onOpen(v, group.versions)}>
                <span className={`src-dot src-${v.source}`} />
                <span className="version-main">
                  <strong>
                    {sourceLabel(v.source)}
                    {v.version ? ` · ${v.version}` : ''}
                    {i === 0 ? <em className="best-tag">mejor</em> : null}
                  </strong>
                  <small>
                    {v.kind === 'tab' ? 'Tablatura' : 'Acordes'}
                    {v.key ? ` · Tono ${v.key}` : ''}
                  </small>
                </span>
                {v.rating ? (
                  <span className="rating">
                    <Icon name="star" size={12} filled /> {v.rating.toFixed(1)}
                    {v.votes ? <small> ({formatCount(v.votes)})</small> : null}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function Avatar({ title, thumb }: { title: string; thumb?: string }) {
  const [failed, setFailed] = useState(false)
  const initials = title
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  // Deterministic hue per title so lists are easy to scan.
  let h = 0
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) % 360
  return thumb && !failed ? (
    <img className="avatar" src={thumb} alt="" loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <span className="avatar avatar-initials" style={{ ['--h' as string]: h }}>
      {initials || '♪'}
    </span>
  )
}

function ResultsSkeleton() {
  return (
    <ul className="results" aria-label="Buscando">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="result skeleton">
          <span className="sk sk-avatar" />
          <span className="sk-lines">
            <span className="sk sk-line" style={{ width: `${60 - i * 6}%` }} />
            <span className="sk sk-line short" />
          </span>
        </li>
      ))}
    </ul>
  )
}

function Welcome() {
  return (
    <div className="welcome">
      <p className="welcome-lead">Letras con acordes, sin publicidad.</p>
      <ul>
        <li>
          <Icon name="search" /> Busca en CifraClub, Ultimate Guitar, LaCuerda y TusAcordes a la vez y abre la versión mejor valorada.
        </li>
        <li>
          <Icon name="capo" /> Cambia el tono o usa cejilla: te sugiere la posición más fácil.
        </li>
        <li>
          <Icon name="play" /> Desplazamiento automático manos libres y pantalla siempre encendida.
        </li>
        <li>
          <Icon name="heart" /> Guarda favoritos: funcionan sin conexión.
        </li>
        <li>
          <Icon name="link" /> También puedes pegar el enlace de una canción.
        </li>
      </ul>
    </div>
  )
}
