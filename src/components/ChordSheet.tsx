import { Fragment, memo, useMemo } from 'react'
import type { Line } from '../sources/types'
import { displayChord, type Notation } from '../lib/chords'
import { buildWords, layoutLines, type Block } from '../lib/layout'

interface Props {
  lines: Line[]
  notation: Notation
  /** Wrap long lines keeping chords over their syllables (vs. original). */
  wrap: boolean
  fontSize: number
  onChordClick: (chord: string) => void
}

/**
 * Renders the chord sheet. In wrap mode (default) chord/lyric pairs are
 * re-flowed for the screen width; in original mode the source's monospace
 * layout is kept and long lines scroll horizontally.
 */
export const ChordSheet = memo(function ChordSheet({ lines, notation, wrap, fontSize, onChordClick }: Props) {
  const blocks = useMemo(() => layoutLines(lines), [lines])
  const chord = (name: string, key: string | number, className = 'chord') => (
    <button key={key} className={className} onClick={() => onChordClick(name)} type="button">
      {displayChord(name, notation)}
    </button>
  )

  if (!wrap) {
    return (
      <div className="sheet sheet-mono" style={{ fontSize: `${Math.round(fontSize * 0.88)}px` }}>
        {blocks.map((b, i) => (
          <MonoBlock key={i} block={b} renderChord={chord} notation={notation} />
        ))}
      </div>
    )
  }

  return (
    <div className="sheet sheet-wrap" style={{ fontSize: `${fontSize}px` }}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'section':
            return (
              <div className="section-label" key={i}>
                {b.label}
              </div>
            )
          case 'blank':
            return <div className="gap" key={i} />
          case 'text':
            return (
              <div className="lyric" key={i}>
                {b.text}
              </div>
            )
          case 'tab':
            return (
              <pre className="tab" key={i}>
                {b.lines.join('\n')}
              </pre>
            )
          case 'chords':
            return (
              <div className="chordrow" key={i}>
                {b.tokens.map((t, j) =>
                  t.chord ? (
                    chord(t.text, j)
                  ) : t.text.trim() ? (
                    <span className="deco" key={j}>
                      {t.text.trim()}
                    </span>
                  ) : null
                )}
              </div>
            )
          case 'pair':
            return (
              <div className="pair" key={i}>
                {buildWords(b.chords, b.lyric).map((w, j) =>
                  'space' in w ? (
                    <Fragment key={j}>{w.space}</Fragment>
                  ) : (
                    <span className="w" key={j}>
                      {w.parts.map((p, k) =>
                        p.chord ? (
                          <span
                            className="a"
                            key={k}
                            style={{ minWidth: `${displayChord(p.chord, notation).length * 0.6 + 0.4}em` }}
                          >
                            {chord(p.chord, 'c', 'chord ch')}
                            {p.text}
                          </span>
                        ) : (
                          <Fragment key={k}>{p.text}</Fragment>
                        )
                      )}
                    </span>
                  )
                )}
              </div>
            )
        }
      })}
    </div>
  )
})

/** Original layout: one monospace line per source line. */
function MonoBlock({
  block,
  renderChord,
  notation,
}: {
  block: Block
  notation: Notation
  renderChord: (name: string, key: string | number, className?: string) => JSX.Element
}) {
  switch (block.type) {
    case 'section':
      return <div className="mono-line section-label">[{block.label}]</div>
    case 'blank':
      return <div className="mono-line"> </div>
    case 'text':
      return <div className="mono-line">{block.text}</div>
    case 'tab':
      return <div className="mono-line tabline">{block.lines.join('\n')}</div>
    case 'chords':
      return (
        <div className="mono-line">
          {block.tokens.map((t, j) => (t.chord ? renderChord(t.text, j) : <span key={j}>{t.text}</span>))}
        </div>
      )
    case 'pair': {
      // Rebuild the chord line with its original columns.
      const out: JSX.Element[] = []
      let col = 0
      block.chords.forEach((c, j) => {
        if (c.col > col) out.push(<span key={`s${j}`}>{' '.repeat(c.col - col)}</span>)
        out.push(renderChord(c.chord, j))
        col = Math.max(col, c.col) + displayChord(c.chord, notation).length
      })
      return (
        <>
          <div className="mono-line">{out}</div>
          <div className="mono-line">{block.lyric}</div>
        </>
      )
    }
  }
}
