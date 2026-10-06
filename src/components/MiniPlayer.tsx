import { useState } from 'react'
import { embedUrl, ytMusicSearchUrl } from '../lib/youtube'
import { Icon } from './Icon'

interface Props {
  videoId: string
  query: string
  onClose: () => void
}

/** Docked YouTube player so you can play along while reading the sheet. */
export function MiniPlayer({ videoId, query, onClose }: Props) {
  const [big, setBig] = useState(false)
  return (
    <div className={`mini-player${big ? ' big' : ''}`}>
      <div className="mini-frame">
        <iframe
          src={embedUrl(videoId)}
          title="Reproductor de YouTube"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="mini-bar">
        <button type="button" className="icon-btn ghost" onClick={() => setBig((b) => !b)} aria-label={big ? 'Reducir' : 'Agrandar'}>
          <Icon name={big ? 'down' : 'up'} size={18} />
        </button>
        <a className="icon-btn ghost" href={ytMusicSearchUrl(query)} target="_blank" rel="noreferrer" aria-label="Abrir en YouTube Music">
          <Icon name="external" size={18} />
        </a>
        <button type="button" className="icon-btn ghost" onClick={onClose} aria-label="Cerrar reproductor">
          <Icon name="x" size={18} />
        </button>
      </div>
    </div>
  )
}
