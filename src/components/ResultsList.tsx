import type { SongSummary } from '../sources/types'
import { SOURCES } from '../sources'

interface Props {
  results: SongSummary[]
  onPick: (s: SongSummary) => void
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating)
  return (
    <span className="stars" aria-label={`${rating.toFixed(1)} de 5`}>
      {'★'.repeat(full)}
      {'☆'.repeat(Math.max(0, 5 - full))}
    </span>
  )
}

export function ResultsList({ results, onPick }: Props) {
  return (
    <ul className="results">
      {results.map((r, i) => (
        <li key={r.id}>
          <button className="result" onClick={() => onPick(r)} type="button">
            <div className="result-main">
              <span className="result-title">{r.title}</span>
              {r.artist ? <span className="result-artist">{r.artist}</span> : null}
            </div>
            <div className="result-meta">
              {i === 0 ? <span className="badge-best">Mejor</span> : null}
              {r.rating ? <Stars rating={r.rating} /> : null}
              {r.votes ? <span className="votes">{r.votes}</span> : null}
              <span className={`src src-${r.source}`}>{SOURCES[r.source]?.label}</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
