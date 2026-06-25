import type { Line } from '../sources/types'

interface Props {
  lines: Line[]
  fontSize: number
  onChordClick?: (chord: string) => void
}

/**
 * Renders the chord sheet in a monospace block so chord/lyric alignment from
 * the source is preserved. Chord tokens are highlighted and tappable.
 */
export function ChordSheet({ lines, fontSize, onChordClick }: Props) {
  return (
    <div
      className="sheet"
      style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}
    >
      {lines.map((line, i) => (
        <div className="sheet-line" key={i}>
          {line.tokens.length === 0 ? (
            ' '
          ) : (
            line.tokens.map((t, j) =>
              t.chord ? (
                <button
                  key={j}
                  className="chord"
                  onClick={() => onChordClick?.(t.text)}
                  type="button"
                >
                  {t.text}
                </button>
              ) : (
                <span key={j}>{t.text}</span>
              )
            )
          )}
        </div>
      ))}
    </div>
  )
}
