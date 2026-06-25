import { useEffect, useState } from 'react'
import { clearDebug, formatDebug, getDebug, subscribeDebug } from '../lib/debug'
import { getBackendUrl, setBackendUrl } from '../lib/settings'

interface Props {
  onClose: () => void
}

export function DebugPanel({ onClose }: Props) {
  const [, force] = useState(0)
  const [backend, setBackend] = useState(getBackendUrl())
  const [copied, setCopied] = useState(false)

  useEffect(() => subscribeDebug(() => force((n) => n + 1)), [])

  const entries = getDebug()

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatDebug())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be blocked; the textarea below is selectable */
    }
  }

  return (
    <div className="debug">
      <div className="debug-head">
        <strong>Diagnóstico</strong>
        <button className="debug-close" onClick={onClose} type="button">✕</button>
      </div>

      <label className="debug-field">
        <span>Backend propio (Cloudflare Worker) — opcional pero recomendado</span>
        <input
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="https://tu-worker.tu-usuario.workers.dev"
          value={backend}
          onChange={(e) => setBackend(e.target.value)}
          onBlur={() => setBackendUrl(backend)}
        />
        <small>
          Sin un backend, la búsqueda depende de proxies públicos que suelen
          bloquear a CifraClub/Ultimate Guitar. Cómo crearlo: ver worker/README.md.
        </small>
      </label>

      <div className="debug-actions">
        <button onClick={copy} type="button">{copied ? '¡Copiado!' : 'Copiar log'}</button>
        <button onClick={() => clearDebug()} type="button">Limpiar</button>
        <span className="debug-count">{entries.length} eventos</span>
      </div>

      <div className="debug-log">
        {entries.length === 0 ? (
          <p className="debug-empty">Haz una búsqueda para ver qué ocurre por debajo.</p>
        ) : (
          entries
            .slice()
            .reverse()
            .map((e, i) => (
              <div key={i} className={`debug-row k-${e.kind} ${e.ok === false ? 'bad' : e.ok ? 'good' : ''}`}>
                <span className="debug-time">{new Date(e.ts).toLocaleTimeString()}</span>
                <span className="debug-label">
                  {e.label}
                  {e.ms != null ? ` · ${e.ms}ms` : ''}
                  {e.detail ? <em> — {e.detail}</em> : null}
                  {e.preview ? <span className="debug-preview">{e.preview}</span> : null}
                </span>
              </div>
            ))
        )}
      </div>
    </div>
  )
}
