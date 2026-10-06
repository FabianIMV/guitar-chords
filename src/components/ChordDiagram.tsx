import type { ChordShape } from '../lib/chordShapes'

interface Props {
  /** Name to display (already in the user's notation). */
  label: string
  shape: ChordShape | null
  size?: 'sm' | 'lg'
}

const STRINGS = 6
const FRETS = 5

/** SVG fingering diagram: nut or fret number, barre, dots, open/muted marks. */
export function ChordDiagram({ label, shape, size = 'sm' }: Props) {
  const W = 100
  const H = 124
  return (
    <figure className={`diagram diagram-${size}`}>
      <figcaption className="diagram-name">
        {label}
        {shape?.approximate ? <span className="approx" title="Aproximado">≈</span> : null}
      </figcaption>
      {shape ? (
        <svg viewBox={`0 0 ${W} ${H}`} className="diagram-svg" role="img" aria-label={`Acorde ${label}`}>
          <Grid shape={shape} W={W} />
        </svg>
      ) : (
        <div className="diagram-missing">sin diagrama</div>
      )}
    </figure>
  )
}

function Grid({ shape, W }: { shape: ChordShape; W: number }) {
  const padL = 16
  const padR = 10
  const padTop = 22
  const gridW = W - padL - padR
  const gridH = 90
  const colW = gridW / (STRINGS - 1)
  const rowH = gridH / FRETS
  const start = shape.baseFret
  const x = (s: number) => padL + s * colW
  const y = (f: number) => padTop + f * rowH

  return (
    <>
      {start === 1 ? (
        <rect x={padL - 1} y={padTop - 4} width={gridW + 2} height={4} rx={1} className="nut" />
      ) : (
        <text x={padL - 5} y={padTop + rowH / 2 + 4} className="diagram-fretnum">
          {start}
        </text>
      )}
      {Array.from({ length: FRETS + 1 }, (_, f) => (
        <line key={`f${f}`} x1={padL} y1={y(f)} x2={padL + gridW} y2={y(f)} className="grid" />
      ))}
      {Array.from({ length: STRINGS }, (_, s) => (
        <line key={`s${s}`} x1={x(s)} y1={padTop} x2={x(s)} y2={padTop + gridH} className="grid" />
      ))}
      {shape.barre && shape.barre.fret - start >= 0 && shape.barre.fret - start < FRETS ? (
        <rect
          x={x(shape.barre.from) - 5.5}
          y={y(shape.barre.fret - start) + rowH / 2 - 5.5}
          width={x(shape.barre.to) - x(shape.barre.from) + 11}
          height={11}
          rx={5.5}
          className="dot"
        />
      ) : null}
      {shape.frets.map((fret, s) => {
        const cx = x(s)
        if (fret === -1) {
          return (
            <text key={s} x={cx} y={padTop - 8} className="diagram-x">
              ×
            </text>
          )
        }
        if (fret === 0) return <circle key={s} cx={cx} cy={padTop - 11} r={3.6} className="open" />
        const rel = fret - start
        if (rel < 0 || rel >= FRETS) return null
        if (shape.barre && fret === shape.barre.fret && s >= shape.barre.from && s <= shape.barre.to) return null
        return <circle key={s} cx={cx} cy={y(rel) + rowH / 2} r={6} className="dot" />
      })}
    </>
  )
}
