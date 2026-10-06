import { useEffect, useMemo, useState } from 'react'
import type { SongSummary } from '../sources/types'
import { getChordShapes } from '../lib/chordShapes'
import { displayChord, transposeKey, type Notation } from '../lib/chords'
import type { CapoSuggestion } from '../lib/music'
import { FONT_MAX, FONT_MIN, setPrefs, type Prefs } from '../lib/settings'
import { sourceLabel } from '../sources'
import { ChordDiagram } from './ChordDiagram'
import { Icon, type IconName } from './Icon'
import { Modal } from './Modal'

/* ---------------- Chord popup (tap a chord) ---------------- */

export function ChordPopup({ chord, notation, onClose }: { chord: string; notation: Notation; onClose: () => void }) {
  const shapes = useMemo(() => getChordShapes(chord), [chord])
  const [i, setI] = useState(0)
  const shape = shapes[i] ?? null
  return (
    <Modal onClose={onClose} variant="center">
      <div className="chord-popup">
        <ChordDiagram label={displayChord(chord, notation)} shape={shape} size="lg" />
        {shapes.length > 1 ? (
          <div className="voicings">
            <button className="icon-btn" type="button" onClick={() => setI((i - 1 + shapes.length) % shapes.length)} aria-label="Posición anterior">
              <Icon name="back" />
            </button>
            <span>
              Posición {i + 1} de {shapes.length}
            </span>
            <button className="icon-btn" type="button" onClick={() => setI((i + 1) % shapes.length)} aria-label="Posición siguiente">
              <Icon name="right" />
            </button>
          </div>
        ) : null}
        {shape?.approximate ? <p className="hint small">≈ forma aproximada (acorde simplificado)</p> : null}
        <button className="btn primary wide" onClick={onClose} type="button">
          Cerrar
        </button>
      </div>
    </Modal>
  )
}

/* ---------------- Capo picker ---------------- */

interface CapoProps {
  capo: number
  sourceCapo: number
  writtenKey?: string
  soundShift: number
  suggestion: CapoSuggestion | null
  notation: Notation
  onChange: (capo: number) => void
  onClose: () => void
}

export function CapoModal({ capo, sourceCapo, writtenKey, soundShift, suggestion, notation, onChange, onClose }: CapoProps) {
  const shapesKey = (c: number) => (writtenKey ? displayChord(transposeKey(writtenKey, soundShift - c), notation) : null)
  return (
    <Modal title="Cejilla" onClose={onClose}>
      <p className="hint">
        La cejilla mantiene el tono de la canción y cambia las formas que tocas.
        {sourceCapo ? ` Esta versión está escrita para cejilla en el traste ${sourceCapo}.` : ''}
      </p>
      {suggestion ? (
        <button className="suggest" type="button" onClick={() => onChange(suggestion.capo)}>
          <Icon name="bulb" />
          <span>
            Más fácil: <strong>cejilla {suggestion.capo}</strong>
            {suggestion.shapesKey ? ` (formas de ${displayChord(suggestion.shapesKey, notation)})` : ''}
          </span>
        </button>
      ) : null}
      <div className="capo-grid">
        {Array.from({ length: 10 }, (_, c) => (
          <button
            key={c}
            type="button"
            className={`capo-cell${c === capo ? ' on' : ''}${suggestion?.capo === c ? ' best' : ''}`}
            onClick={() => onChange(c)}
          >
            <strong>{c === 0 ? 'Sin' : c}</strong>
            {shapesKey(c) ? <small>{shapesKey(c)}</small> : null}
          </button>
        ))}
      </div>
    </Modal>
  )
}

/* ---------------- Options ("Más") ---------------- */

interface OptionsProps {
  prefs: Prefs
  fontSize: number
  onFontSize: (n: number) => void
  actions: Array<{ icon: IconName; label: string; run: () => void; hint?: string }>
  onClose: () => void
}

export function OptionsModal({ prefs, fontSize, onFontSize, actions, onClose }: OptionsProps) {
  return (
    <Modal title="Opciones" onClose={onClose}>
      <div className="opt-row">
        <span className="opt-label">
          <Icon name="text" /> Tamaño
        </span>
        <div className="stepper">
          <button type="button" onClick={() => onFontSize(Math.max(FONT_MIN, fontSize - 1))} aria-label="Reducir letra">
            <Icon name="minus" />
          </button>
          <span>{fontSize}</span>
          <button type="button" onClick={() => onFontSize(Math.min(FONT_MAX, fontSize + 1))} aria-label="Aumentar letra">
            <Icon name="plus" />
          </button>
        </div>
      </div>
      <div className="opt-row">
        <span className="opt-label">
          <Icon name="note" /> Notación
        </span>
        <Segmented
          value={prefs.notation}
          options={[
            ['english', 'C D E'],
            ['latin', 'Do Re Mi'],
          ]}
          onChange={(v) => setPrefs({ notation: v })}
        />
      </div>
      <div className="opt-row">
        <span className="opt-label">
          <Icon name="wrap" /> Formato
        </span>
        <Segmented
          value={prefs.wrap ? 'wrap' : 'mono'}
          options={[
            ['wrap', 'Ajustado'],
            ['mono', 'Original'],
          ]}
          onChange={(v) => setPrefs({ wrap: v === 'wrap' })}
        />
      </div>
      <Toggle icon="grid" label="Diagramas de acordes" value={prefs.showDiagrams} onChange={(v) => setPrefs({ showDiagrams: v })} />
      <Toggle icon="sun" label="Pantalla siempre encendida" value={prefs.keepAwake} onChange={(v) => setPrefs({ keepAwake: v })} />
      <div className="opt-actions">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            className="opt-action"
            onClick={() => {
              onClose()
              a.run()
            }}
          >
            <Icon name={a.icon} />
            <span>{a.label}</span>
            {a.hint ? <small>{a.hint}</small> : null}
          </button>
        ))}
      </div>
    </Modal>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<[T, string]>
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ icon, label, value, onChange, hint }: { icon?: IconName; label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="opt-row toggle-row">
      <span className="opt-label">
        {icon ? <Icon name={icon} /> : null}
        <span>
          {label}
          {hint ? <small className="opt-hint">{hint}</small> : null}
        </span>
      </span>
      <input type="checkbox" className="switch" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

/* ---------------- Versions ---------------- */

interface VersionsProps {
  currentId: string
  versions: SongSummary[] | null
  searching: boolean
  onSearch: () => void
  onPick: (s: SongSummary) => void
  onClose: () => void
}

export function VersionsModal({ currentId, versions, searching, onSearch, onPick, onClose }: VersionsProps) {
  useEffect(() => {
    if (!versions && !searching) onSearch()
  }, [versions, searching, onSearch])
  return (
    <Modal title="Versiones" onClose={onClose}>
      {searching ? <p className="hint">Buscando otras versiones…</p> : null}
      {versions && versions.length === 0 && !searching ? <p className="hint">No encontré otras versiones.</p> : null}
      <ul className="version-list">
        {(versions ?? []).map((v) => (
          <li key={v.id}>
            <button type="button" className={`version-row${v.id === currentId ? ' on' : ''}`} onClick={() => onPick(v)}>
              <span className={`src-dot src-${v.source}`} />
              <span className="version-main">
                <strong>
                  {sourceLabel(v.source)}
                  {v.version ? ` · ${v.version}` : ''}
                </strong>
                <small>
                  {v.kind === 'tab' ? 'Tablatura' : 'Acordes'}
                  {v.key ? ` · Tono ${v.key}` : ''}
                </small>
              </span>
              {v.rating ? (
                <span className="rating">
                  <Icon name="star" size={14} filled /> {v.rating.toFixed(1)}
                  {v.votes ? <small> ({formatCount(v.votes)})</small> : null}
                </span>
              ) : null}
              {v.id === currentId ? <Icon name="check" /> : null}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}
