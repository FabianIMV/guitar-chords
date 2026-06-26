import { useEffect, useMemo, useState } from 'react'
import type { SongDetail } from '../sources/types'
import { transposeLines, uniqueChords } from '../lib/chords'
import { isFavorite, toggleFavorite } from '../lib/storage'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { ChordSheet } from './ChordSheet'
import { ChordDiagram } from './ChordDiagram'
import { YouTubePlayer } from './YouTubePlayer'
import { SOURCES } from '../sources'

interface Props {
  song: SongDetail
  onBack: () => void
}

export function SongView({ song, onBack }: Props) {
  const [steps, setSteps] = useState(0)
  const [fontSize, setFontSize] = useState(15)
  const [showDiagrams, setShowDiagrams] = useState(true)
  const [fav, setFav] = useState(false)
  const [popupChord, setPopupChord] = useState<string | null>(null)
  const { running, setRunning, speed, setSpeed } = useAutoScroll()

  useEffect(() => {
    setFav(isFavorite(song.id))
    setSteps(0)
    window.scrollTo(0, 0)
  }, [song.id])

  const lines = useMemo(() => transposeLines(song.lines, steps), [song.lines, steps])
  const chords = useMemo(() => uniqueChords(lines), [lines])
  const hasChords = chords.length > 0

  return (
    <div className="songview">
      <div className="song-header">
        <button className="back" onClick={onBack} type="button" aria-label="Volver">
          ‹
        </button>
        <div className="song-titles">
          <h1>{song.title}</h1>
          {song.artist ? <p>{song.artist}</p> : null}
        </div>
        <button
          className={`fav ${fav ? 'on' : ''}`}
          onClick={() => setFav(toggleFavorite({ ...song, lines: song.lines }))}
          type="button"
          aria-label="Guardar en favoritos"
        >
          {fav ? '♥' : '♡'}
        </button>
      </div>

      <div className="song-tags">
        {song.key ? <span className="tag">Tono: {song.key}</span> : null}
        {song.capo ? <span className="tag">Cejilla: {song.capo}</span> : null}
        {song.tuning ? <span className="tag">Afinación: {song.tuning}</span> : null}
        {steps !== 0 ? (
          <span className="tag tag-active">
            Transpuesto {steps > 0 ? `+${steps}` : steps}
          </span>
        ) : null}
        <a className="tag tag-link" href={song.url} target="_blank" rel="noreferrer">
          {SOURCES[song.source]?.label} ↗
        </a>
      </div>

      <YouTubePlayer title={song.title} artist={song.artist} />

      {showDiagrams && hasChords ? (
        <div className="diagrams">
          {chords.map((c) => (
            <ChordDiagram key={c} name={c} />
          ))}
        </div>
      ) : null}

      <ChordSheet lines={lines} fontSize={fontSize} onChordClick={setPopupChord} />

      {popupChord ? (
        <div className="chord-popup-backdrop" onClick={() => setPopupChord(null)}>
          <div className="chord-popup" onClick={(e) => e.stopPropagation()}>
            <ChordDiagram name={popupChord} />
            <button className="chord-popup-close" onClick={() => setPopupChord(null)} type="button">
              Cerrar
            </button>
          </div>
        </div>
      ) : null}

      {!hasChords ? (
        <p className="empty">
          No se detectaron acordes en esta versión. Prueba otra de la lista o
          ábrela en el sitio original.
        </p>
      ) : null}

      {/* Sticky control bar */}
      <div className="toolbar">
        <div className="tool-group" aria-label="Transponer">
          <button onClick={() => setSteps((s) => s - 1)} type="button">♭</button>
          <span className="tool-val">{steps > 0 ? `+${steps}` : steps}</span>
          <button onClick={() => setSteps((s) => s + 1)} type="button">♯</button>
        </div>
        <div className="tool-group" aria-label="Tamaño de letra">
          <button onClick={() => setFontSize((f) => Math.max(11, f - 1))} type="button">A−</button>
          <button onClick={() => setFontSize((f) => Math.min(26, f + 1))} type="button">A+</button>
        </div>
        <button
          className={`tool-toggle ${showDiagrams ? 'on' : ''}`}
          onClick={() => setShowDiagrams((v) => !v)}
          type="button"
        >
          🎸
        </button>
        <div className="tool-group" aria-label="Auto-scroll">
          <button
            className={running ? 'playing' : ''}
            onClick={() => setRunning((r) => !r)}
            type="button"
          >
            {running ? '⏸' : '▶'}
          </button>
          <input
            type="range"
            min={1}
            max={10}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            aria-label="Velocidad"
          />
        </div>
      </div>
    </div>
  )
}
