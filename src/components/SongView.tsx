import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SongDetail, SongSummary } from '../sources/types'
import { fetchSong, searchAll, sourceLabel, summaryFromUrl } from '../sources'
import {
  chordSequence,
  displayChord,
  keyUsesFlats,
  transposeKey,
  transposeLines,
  uniqueChords,
} from '../lib/chords'
import { getChordShape } from '../lib/chordShapes'
import { resolveWrittenKey, suggestCapo } from '../lib/music'
import { songKey } from '../lib/search'
import { isAbort } from '../lib/proxy'
import { goBack, songShareUrl } from '../lib/router'
import { FONT_MAX, FONT_MIN, setPrefs } from '../lib/settings'
import {
  cacheSong,
  getCachedSong,
  getFavorite,
  getScrollSpeed,
  getSongPrefs,
  isFavorite,
  pushRecent,
  restoreFavorite,
  setScrollSpeed,
  setSongPrefs,
  toggleFavorite,
} from '../lib/storage'
import { resolveVideoId, ytSearchUrl } from '../lib/youtube'
import { PX_PER_SPEED, useAutoScroll } from '../hooks/useAutoScroll'
import { usePrefs } from '../hooks/useStores'
import { useWakeLock } from '../hooks/useWakeLock'
import { ChordDiagram } from './ChordDiagram'
import { ChordSheet } from './ChordSheet'
import { Icon } from './Icon'
import { MiniPlayer } from './MiniPlayer'
import { CapoModal, ChordPopup, OptionsModal, VersionsModal, formatCount } from './SongModals'
import { toast } from './Toast'

interface Props {
  url: string
  /** Summary and sibling versions when opened from a search result. */
  hint?: { summary: SongSummary; versions?: SongSummary[] }
  onOpenVersion: (s: SongSummary, versions?: SongSummary[]) => void
}

const REFRESH_AFTER_MS = 3 * 24 * 3600 * 1000

type Modal = 'options' | 'capo' | 'versions' | null

export function SongView({ url, hint, onOpenVersion }: Props) {
  const prefs = usePrefs()
  const summary = useMemo<SongSummary>(
    () =>
      hint?.summary ??
      summaryFromUrl(url) ?? { id: url, source: 'cifraclub', title: 'Canción', artist: '', url, score: 1 },
    [url, hint]
  )

  /* ---------- loading ---------- */
  const [song, setSong] = useState<SongDetail | null>(() => getFavorite(summary.id) ?? getCachedSong(summary.id))
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    const local = getFavorite(summary.id) ?? getCachedSong(summary.id)
    setSong(local)
    setError(null)
    window.scrollTo(0, 0)
    const age = local ? Date.now() - (local.fetchedAt ?? (local as { cachedAt?: number }).cachedAt ?? 0) : Infinity
    if (local && local.lines.length && age < REFRESH_AFTER_MS && reloadTick === 0) {
      pushRecent({ ...summary, title: local.title, artist: local.artist, key: local.key })
      return
    }
    const ctrl = new AbortController()
    setRefreshing(true)
    fetchSong(summary, { signal: ctrl.signal })
      .then((fresh) => {
        if (!fresh.lines.length) throw new Error('la página no trae acordes')
        setSong(fresh)
        cacheSong(fresh)
        // Keep an offline favorite up to date.
        const fav = getFavorite(fresh.id)
        if (fav) restoreFavorite({ ...fresh, savedAt: fav.savedAt })
        pushRecent({ ...summary, title: fresh.title, artist: fresh.artist, key: fresh.key })
      })
      .catch((e) => {
        if (isAbort(e)) return
        if (!local) setError(String((e as Error)?.message || e))
        else if (reloadTick > 0) toast('No se pudo actualizar; mostrando la copia guardada')
      })
      .finally(() => setRefreshing(false))
    return () => ctrl.abort()
  }, [summary, reloadTick])

  /* ---------- per-song settings ---------- */
  const songId = song?.id ?? summary.id
  const sourceCapo = song?.capoFret ?? 0
  const [steps, setSteps] = useState(0)
  const [capo, setCapo] = useState(0)
  const [speedInit, setSpeedInit] = useState(getScrollSpeed())
  useEffect(() => {
    const p = getSongPrefs(songId)
    setSteps(p.steps)
    setCapo(p.capo ?? sourceCapo)
    setSpeedInit(p.speed ?? getScrollSpeed())
  }, [songId, sourceCapo])

  const updateSteps = (n: number) => {
    const v = ((n % 12) + 12) % 12 > 6 ? (((n % 12) + 12) % 12) - 12 : ((n % 12) + 12) % 12
    setSteps(v)
    setSongPrefs(songId, { steps: v })
  }
  const updateCapo = (c: number) => {
    setCapo(c)
    setSongPrefs(songId, { capo: c === sourceCapo ? undefined : c })
  }

  /* ---------- derived music ---------- */
  const writtenChords = useMemo(() => (song ? uniqueChords(song.lines) : []), [song])
  const writtenKey = useMemo(
    () => (song ? resolveWrittenKey(chordSequence(song.lines), song.key, sourceCapo) : undefined),
    [song, sourceCapo]
  )
  const soundShift = sourceCapo + steps // written chords → sounding pitch
  const shift = soundShift - capo // written chords → shapes you play
  const soundingKey = writtenKey ? transposeKey(writtenKey, soundShift) : undefined
  const originalKey = writtenKey ? transposeKey(writtenKey, sourceCapo) : undefined
  const shapesKey = writtenKey ? transposeKey(writtenKey, shift) : undefined
  const flats = shift !== 0 && shapesKey ? keyUsesFlats(shapesKey) : undefined
  const lines = useMemo(() => (song ? transposeLines(song.lines, shift, flats) : []), [song, shift, flats])
  const chords = useMemo(() => uniqueChords(lines), [lines])
  const suggestion = useMemo(
    () => suggestCapo(writtenChords, soundShift, capo, writtenKey),
    [writtenChords, soundShift, capo, writtenKey]
  )

  /* ---------- reading ---------- */
  const [fontSize, setFontSizeState] = useState(prefs.fontSize)
  useEffect(() => setFontSizeState(prefs.fontSize), [prefs.fontSize])
  const setFontSize = (n: number) => {
    const v = Math.round(Math.min(FONT_MAX, Math.max(FONT_MIN, n)))
    setFontSizeState(v)
    setPrefs({ fontSize: v })
  }
  const sheetRef = useRef<HTMLDivElement>(null)
  usePinchZoom(sheetRef, fontSize, setFontSize)

  const { running, setRunning, speed, setSpeed, held } = useAutoScroll(speedInit, (s) => {
    setScrollSpeed(s)
    setSongPrefs(songId, { speed: s })
  })
  useWakeLock(prefs.keepAwake && !!song)
  const headerHidden = useHideOnScroll()

  /* ---------- favorites / share ---------- */
  const [fav, setFav] = useState(false)
  useEffect(() => setFav(isFavorite(songId)), [songId, song])
  const onToggleFav = () => {
    if (!song) return
    const res = toggleFavorite(song)
    if (res === null) {
      toast('No queda espacio para más favoritos')
      return
    }
    setFav(res)
    toast(res ? 'Guardada en favoritos (disponible sin conexión)' : 'Quitada de favoritos')
  }
  const share = async () => {
    const link = songShareUrl(song?.url ?? url)
    const data = { title: `${song?.title ?? summary.title} — ${song?.artist ?? summary.artist}`, url: link }
    try {
      if (navigator.share) await navigator.share(data)
      else {
        await navigator.clipboard.writeText(link)
        toast('Enlace copiado')
      }
    } catch {
      /* cancelled */
    }
  }

  /* ---------- YouTube ---------- */
  const [video, setVideo] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  useEffect(() => setVideo(null), [songId])
  const listen = async () => {
    if (!song) return
    if (song.videoId) {
      setVideo(song.videoId)
      return
    }
    setVideoLoading(true)
    try {
      const id = await resolveVideoId(song.title, song.artist)
      if (id) setVideo(id)
      else throw new Error('sin video')
    } catch {
      toast('No encontré el video; ábrelo en YouTube', {
        label: 'Abrir',
        run: () => window.open(ytSearchUrl(`${song.artist} ${song.title}`), '_blank'),
      })
    } finally {
      setVideoLoading(false)
    }
  }

  /* ---------- versions ---------- */
  const [versions, setVersions] = useState<SongSummary[] | null>(hint?.versions && hint.versions.length > 1 ? hint.versions : null)
  const [searchingVersions, setSearchingVersions] = useState(false)
  useEffect(() => {
    setVersions(hint?.versions && hint.versions.length > 1 ? hint.versions : null)
  }, [hint])
  const findVersions = useCallback(() => {
    const base = song ?? summary
    setSearchingVersions(true)
    const key = songKey(base.title, base.artist)
    searchAll(`${base.title} ${base.artist}`)
      .then((res) => {
        const same = res.results.filter((r) => songKey(r.title, r.artist) === key)
        if (!same.some((s) => s.id === base.id)) same.unshift(summary)
        setVersions(same.sort((a, b) => b.score - a.score))
      })
      .catch(() => setVersions([summary]))
      .finally(() => setSearchingVersions(false))
  }, [song, summary])

  const [modal, setModal] = useState<Modal>(null)
  const [popupChord, setPopupChord] = useState<string | null>(null)
  const onChordClick = useCallback((c: string) => setPopupChord(c), [])

  const title = song?.title ?? summary.title
  const artist = song?.artist ?? summary.artist
  const linesPerMin = Math.max(1, Math.round((speed * PX_PER_SPEED * 60) / (fontSize * 2.4)))
  const hasChords = chords.length > 0

  return (
    <div className="songview">
      <header className={`song-header${headerHidden && running ? ' hidden' : ''}`}>
        <button className="icon-btn" onClick={() => goBack()} type="button" aria-label="Volver">
          <Icon name="back" />
        </button>
        <div className="song-titles">
          <h1>{title}</h1>
          {artist ? <p>{artist}</p> : null}
        </div>
        <button
          className={`icon-btn${fav ? ' fav-on' : ''}`}
          onClick={onToggleFav}
          type="button"
          aria-label={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          aria-pressed={fav}
          disabled={!song}
        >
          <Icon name="heart" filled={fav} />
        </button>
      </header>

      {song ? (
        <div className="song-meta">
          {soundingKey ? (
            <span className={`chip${steps ? ' chip-accent' : ''}`}>
              Tono <strong>{displayChord(soundingKey, prefs.notation)}</strong>
              {steps && originalKey ? <small> (orig. {displayChord(originalKey, prefs.notation)})</small> : null}
            </span>
          ) : null}
          <button className={`chip${capo ? ' chip-accent' : ''}`} type="button" onClick={() => setModal('capo')}>
            {capo ? (
              <>
                Cejilla <strong>{capo}</strong>
                {shapesKey ? <small> · formas de {displayChord(shapesKey, prefs.notation)}</small> : null}
              </>
            ) : (
              'Sin cejilla'
            )}
          </button>
          {suggestion ? (
            <button className="chip chip-suggest" type="button" onClick={() => updateCapo(suggestion.capo)}>
              <Icon name="bulb" size={15} /> Más fácil con cejilla {suggestion.capo}
            </button>
          ) : null}
          {song.tuning ? <span className="chip">Afinación {song.tuning}</span> : null}
          {song.difficulty ? <span className="chip">{song.difficulty}</span> : null}
          {song.rating ? (
            <span className="chip">
              <Icon name="star" size={14} filled /> {song.rating.toFixed(1)}
              {song.votes ? <small> ({formatCount(song.votes)})</small> : null}
            </span>
          ) : null}
          {versions && versions.length > 1 ? (
            <button className="chip" type="button" onClick={() => setModal('versions')}>
              <Icon name="versions" size={15} /> {versions.length} versiones
            </button>
          ) : null}
          <a className="chip chip-link" href={song.url} target="_blank" rel="noreferrer">
            {sourceLabel(song.source)}
            {song.version ? ` ${song.version}` : ''} <Icon name="external" size={13} />
          </a>
          {refreshing ? <span className="chip chip-muted">Actualizando…</span> : null}
        </div>
      ) : null}

      {song && prefs.showDiagrams && hasChords ? (
        <div className="diagrams" aria-label="Acordes de la canción">
          {chords.map((c) => (
            <button key={c} type="button" className="diagram-btn" onClick={() => setPopupChord(c)}>
              <ChordDiagram label={displayChord(c, prefs.notation)} shape={getChordShape(c)} />
            </button>
          ))}
        </div>
      ) : null}

      <div ref={sheetRef} className="sheet-wrap-outer">
        {song ? (
          hasChords || song.lines.length ? (
            <ChordSheet lines={lines} notation={prefs.notation} wrap={prefs.wrap} fontSize={fontSize} onChordClick={onChordClick} />
          ) : null
        ) : error ? (
          <div className="state-card error-card">
            <Icon name="offline" size={28} />
            <p>
              <strong>No se pudo cargar la canción.</strong>
              <br />
              <small>{error}</small>
            </p>
            <div className="row-actions">
              <button className="btn primary" type="button" onClick={() => setReloadTick((n) => n + 1)}>
                <Icon name="refresh" size={18} /> Reintentar
              </button>
              <button className="btn" type="button" onClick={() => setModal('versions')}>
                Otra versión
              </button>
              <a className="btn" href={url} target="_blank" rel="noreferrer">
                Abrir sitio
              </a>
            </div>
          </div>
        ) : (
          <SheetSkeleton />
        )}
        {song && !hasChords ? (
          <p className="state-card">No se detectaron acordes en esta versión. Prueba otra versión o ábrela en el sitio original.</p>
        ) : null}
      </div>

      {video ? <MiniPlayer videoId={video} query={`${artist} ${title}`} onClose={() => setVideo(null)} /> : null}

      {running ? (
        <div className="speedbar">
          <button type="button" className="icon-btn" onClick={() => setSpeed(speed - (speed > 2 ? 0.5 : 0.2))} aria-label="Más lento">
            <Icon name="minus" />
          </button>
          <input
            className="speed-slider"
            type="range"
            min={0.3}
            max={10}
            step={0.1}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            aria-label="Velocidad de desplazamiento"
          />
          <button type="button" className="icon-btn" onClick={() => setSpeed(speed + (speed >= 2 ? 0.5 : 0.2))} aria-label="Más rápido">
            <Icon name="plus" />
          </button>
          <span className="speed-readout">
            {held ? 'en pausa' : (
              <>
                <strong>{linesPerMin}</strong> líneas/min
              </>
            )}
          </span>
        </div>
      ) : null}

      <nav className="toolbar" aria-label="Controles de la canción">
        <div className="tool-group" aria-label="Tono">
          <button type="button" onClick={() => updateSteps(steps - 1)} aria-label="Bajar medio tono">
            <Icon name="minus" size={20} />
          </button>
          <button type="button" className="tool-val" onClick={() => updateSteps(0)} aria-label="Restablecer tono">
            <small>Tono</small>
            <strong>
              {soundingKey ? displayChord(soundingKey, prefs.notation) : steps > 0 ? `+${steps}` : steps}
            </strong>
          </button>
          <button type="button" onClick={() => updateSteps(steps + 1)} aria-label="Subir medio tono">
            <Icon name="plus" size={20} />
          </button>
        </div>
        <button type="button" className={`tool-btn${capo ? ' on' : ''}`} onClick={() => setModal('capo')}>
          <Icon name="capo" />
          <small>{capo ? `Cejilla ${capo}` : 'Cejilla'}</small>
        </button>
        <button
          type="button"
          className={`tool-btn${running ? ' on' : ''}`}
          onClick={() => setRunning(!running)}
          disabled={!song}
          aria-label={running ? 'Pausar desplazamiento' : 'Desplazamiento automático'}
        >
          <Icon name={running ? 'pause' : 'play'} />
          <small>{running ? 'Pausa' : 'Auto'}</small>
        </button>
        <button
          type="button"
          className={`tool-btn${video ? ' on' : ''}`}
          onClick={() => (video ? setVideo(null) : listen())}
          disabled={!song || videoLoading}
        >
          <Icon name="youtube" />
          <small>{videoLoading ? 'Buscando…' : 'Escuchar'}</small>
        </button>
        <button type="button" className="tool-btn" onClick={() => setModal('options')}>
          <Icon name="more" />
          <small>Más</small>
        </button>
      </nav>

      {modal === 'options' ? (
        <OptionsModal
          prefs={prefs}
          fontSize={fontSize}
          onFontSize={setFontSize}
          onClose={() => setModal(null)}
          actions={[
            { icon: 'versions', label: 'Otras versiones', run: () => setModal('versions'), hint: versions ? String(versions.length) : undefined },
            { icon: 'share', label: 'Compartir', run: share },
            { icon: 'refresh', label: 'Recargar desde el sitio', run: () => setReloadTick((n) => n + 1) },
            { icon: 'external', label: `Abrir en ${sourceLabel(summary.source)}`, run: () => window.open(song?.url ?? url, '_blank') },
          ]}
        />
      ) : null}
      {modal === 'capo' ? (
        <CapoModal
          capo={capo}
          sourceCapo={sourceCapo}
          writtenKey={writtenKey}
          soundShift={soundShift}
          suggestion={suggestion}
          notation={prefs.notation}
          onChange={(c) => {
            updateCapo(c)
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal === 'versions' ? (
        <VersionsModal
          currentId={songId}
          versions={versions}
          searching={searchingVersions}
          onSearch={findVersions}
          onPick={(v) => {
            setModal(null)
            if (v.id !== songId) onOpenVersion(v, versions ?? undefined)
          }}
          onClose={() => setModal(null)}
        />
      ) : null}
      {popupChord ? <ChordPopup chord={popupChord} notation={prefs.notation} onClose={() => setPopupChord(null)} /> : null}
    </div>
  )
}

function SheetSkeleton() {
  return (
    <div className="skeleton-sheet" aria-label="Cargando canción">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="sk-pair">
          <span className="sk sk-chord" style={{ width: `${20 + ((i * 37) % 40)}%` }} />
          <span className="sk sk-line" style={{ width: `${55 + ((i * 53) % 40)}%` }} />
        </div>
      ))}
    </div>
  )
}

/** Hide the header while scrolling down (more room for the sheet). */
function useHideOnScroll(): boolean {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (y < 80) setHidden(false)
      else if (y > last + 4) setHidden(true)
      else if (y < last - 8) setHidden(false)
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return hidden
}

/** Two-finger pinch on the sheet changes the font size. */
function usePinchZoom(ref: React.RefObject<HTMLElement>, size: number, setSize: (n: number) => void) {
  const sizeRef = useRef(size)
  sizeRef.current = size
  const setRef = useRef(setSize)
  setRef.current = setSize
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let startDist = 0
    let startSize = 0
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches)
        startSize = sizeRef.current
      }
    }
    const move = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !startDist) return
      e.preventDefault()
      const next = Math.round(startSize * (dist(e.touches) / startDist))
      if (next !== sizeRef.current) setRef.current(next)
    }
    const end = () => {
      startDist = 0
    }
    // iOS: stop the native page zoom so the pinch only resizes the text.
    const gesture = (e: Event) => e.preventDefault()
    el.addEventListener('gesturestart', gesture)
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('gesturestart', gesture)
    }
  }, [ref])
}
