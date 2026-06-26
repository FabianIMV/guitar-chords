import { useEffect, useState } from 'react'
import { embedUrl, resolveVideoId, ytMusicSearchUrl, ytSearchUrl } from '../lib/youtube'

interface Props {
  title: string
  artist: string
}

/**
 * "Listen while you play" widget. Tapping play resolves the song's video and
 * embeds an inline YouTube player; deep links to YouTube Music / YouTube are
 * always available as a fallback (and open the native app on iPhone).
 */
export function YouTubePlayer({ title, artist }: Props) {
  const query = `${artist} ${title}`.trim()
  const [videoId, setVideoId] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  // Reset when the song changes.
  useEffect(() => {
    setVideoId(null)
    setState('idle')
  }, [query])

  async function play() {
    setState('loading')
    try {
      const id = await resolveVideoId(query)
      if (id) {
        setVideoId(id)
        setState('idle')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  if (videoId) {
    return (
      <div className="yt">
        <div className="yt-frame">
          <iframe
            src={embedUrl(videoId)}
            title="Reproductor de YouTube"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="yt-links">
          <button className="yt-close" onClick={() => setVideoId(null)} type="button">
            Ocultar
          </button>
          <a href={ytMusicSearchUrl(query)} target="_blank" rel="noreferrer">YT Music ↗</a>
        </div>
      </div>
    )
  }

  return (
    <div className="yt yt-bar">
      <button className="yt-play" onClick={play} disabled={state === 'loading'} type="button">
        {state === 'loading' ? '⏳ Buscando…' : '▶ Escuchar'}
      </button>
      <a className="yt-link" href={ytMusicSearchUrl(query)} target="_blank" rel="noreferrer">
        YT Music ↗
      </a>
      <a className="yt-link" href={ytSearchUrl(query)} target="_blank" rel="noreferrer">
        YouTube ↗
      </a>
      {state === 'error' ? (
        <span className="yt-err">No pude incrustar; usa los enlaces ↗</span>
      ) : null}
    </div>
  )
}
