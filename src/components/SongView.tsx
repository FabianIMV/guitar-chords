import { useEffect, useMemo, useState } from 'react'
import type { SongDetail } from '../sources/types'
import { transposeChord, transposeLines, uniqueChords } from '../lib/chords'
import {
  getFontSize,
  getTranspose,
  isFavorite,
  SCROLL_SPEED_MAX,
  SCROLL_SPEED_MIN,
  setFontSize as saveFontSize,
  setTranspose as saveTranspose,
  toggleFavorite,
} from '../lib/storage'
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
  const [fontSize, setFontSize] = useState(() => getFontSize())
  const [showDiagrams, setShowDiagrams] = useState(true)
  const [fav, setFav] = useState(false)
  const [popupChord, setPopupChord] = useState<string | null>(null)
  const { running, setRunning, speed, setSpeed } = useAutoScroll()

  useEffect(() => {
    setFav(isFavorite(song.id))
    setSteps(getTranspose(song.id)) // reopen in "your" key
    window.scrollTo(0, 0)
  }, [song.id])

  // Persist reading preferences.
  useEffect(() => saveTranspose(song.id, steps), [song.id, steps])
  useEffect(() => saveFontSize(fontSize), [fontSize])

  async function share() {
    const data = {
      title: `${song.title} — ${song.artist}`,
      text: `Acordes de ${song.title} (${song.artist})`,
      url: song.url,
    }
    try {
      if (navigator.share) await navigator.share(data)
      else await navigator.clipboard.writeText(song.url)
    } catch {
      /* user cancelled the share sheet */
    }
  }

  const lines = useMemo(() => transposeLines(song.lines, steps), [song.lines, steps])
  const chords = useMemo(() => uniqueChords(lines), [lines])
  const hasChords = chords.length > 0

  // Approximate reading speed as "lines per minute" — a more intuitive,
  // tempo-like number than a bare 1..10 slider value.
  const pxPerSec = speed * 14
  const lineHeightPx = fontSize * 1.5
  const linesPerMin = Math.max(1, Math.round((pxPerSec * 60) / lineHeightPx))

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
        <button className="share" onClick={share} type="button" aria-label="Compartir">
          ⇪
        </button>
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
        {song.key ? (
          <span className="tag">
            Tono: {song.key}
            {steps !== 0 ? ` → ${transposeChord(song.key, steps)}` : ''}
          </span>
        ) : null}
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
        <div className="toolbar-row">
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
          <button
            className={`tool-toggle ${running ? 'on' : ''}`}
            onClick={() => setRunning((r) => !r)}
            type="button"
            aria-label={running ? 'Pausar auto-scroll' : 'Iniciar auto-scroll'}
          >
            {running ? '⏸' : '▶'}
          </button>
        </div>

        <div className="toolbar-row speed-row" aria-label="Velocidad de auto-scroll">
          <span className="speed-label">🐢</span>
          <input
            className="speed-slider"
            type="range"
            min={SCROLL_SPEED_MIN}
            max={SCROLL_SPEED_MAX}
            step={0.1}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            aria-label="Velocidad de auto-scroll"
          />
          <span className="speed-label">🐇</span>
          <span className="speed-readout">
            <strong>{linesPerMin}</strong> líneas/min
          </span>
        </div>
      </div>
    </div>
  )
}
