import { getChordShape } from '../lib/chordShapes'

interface Props {
  name: string
}

const W = 90
const H = 116
const STRINGS = 6
const FRETS = 5

/** Renders an SVG fingering diagram for a chord name. */
export function ChordDiagram({ name }: Props) {
  const shape = getChordShape(name)
  if (!shape) {
    return (
      <div className="diagram">
        <div className="diagram-name">{name}</div>
        <div className="diagram-missing">sin diagrama</div>
      </div>
    )
  }

  const padX = 12
  const padTop = 18
  const gridW = W - padX * 2
  const gridH = 78
  const colW = gridW / (STRINGS - 1)
  const rowH = gridH / FRETS

  // Window of frets to display.
  const start = shape.baseFret <= 1 ? 1 : shape.baseFret

  const x = (s: number) => padX + s * colW
  const y = (f: number) => padTop + f * rowH

  return (
    <div className="diagram">
      <div className="diagram-name">
        {name}
        {shape.approximate ? <span className="approx">≈</span> : null}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="diagram-svg" aria-label={`Acorde ${name}`}>
        {/* Nut (thick) when at first position */}
        {start === 1 ? (
          <rect x={padX} y={padTop - 3} width={gridW} height={3} fill="currentColor" />
        ) : (
          <text x={padX - 6} y={padTop + rowH - 4} className="diagram-fretnum">
            {start}
          </text>
        )}
        {/* Frets */}
        {Array.from({ length: FRETS + 1 }, (_, f) => (
          <line key={`f${f}`} x1={padX} y1={y(f)} x2={padX + gridW} y2={y(f)} className="grid" />
        ))}
        {/* Strings */}
        {Array.from({ length: STRINGS }, (_, s) => (
          <line key={`s${s}`} x1={x(s)} y1={padTop} x2={x(s)} y2={padTop + gridH} className="grid" />
        ))}
        {/* Markers: open / muted above nut, dots on frets */}
        {shape.frets.map((fret, idx) => {
          const s = idx // low E (0) .. high E (5) maps left->right
          const cx = x(s)
          if (fret === -1) {
            return (
              <text key={idx} x={cx} y={padTop - 6} className="diagram-x">
                ✕
              </text>
            )
          }
          if (fret === 0) {
            return <circle key={idx} cx={cx} cy={padTop - 9} r={3} className="open" />
          }
          const rel = fret - start
          if (rel < 0 || rel >= FRETS) return null
          const cy = y(rel) + rowH / 2
          return <circle key={idx} cx={cx} cy={cy} r={5} className="dot" />
        })}
      </svg>
    </div>
  )
}
