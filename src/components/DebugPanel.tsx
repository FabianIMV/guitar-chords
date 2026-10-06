import { useEffect, useState } from 'react'
import { clearDebug, formatDebug, getDebug, subscribeDebug } from '../lib/debug'
import { getRouteHealth, resetRouteHealth } from '../lib/proxy'
import { toast } from './Toast'

/** Network log + what the fetch layer learned per host. */
export function DebugPanel() {
  const [, force] = useState(0)
  useEffect(() => subscribeDebug(() => force((n) => n + 1)), [])
  const entries = getDebug()
  const health = getRouteHealth()

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatDebug())
      toast('Registro copiado')
    } catch {
      toast('No se pudo copiar')
    }
  }

  return (
    <div className="debug">
      {health.length ? (
        <>
          <h3>Rutas aprendidas por sitio</h3>
          <table className="health">
            <tbody>
              {health.map((h) => {
                const [host, route] = h.key.split('|')
                const rate = (h.ok + 1) / (h.ok + h.fail + 2)
                return (
                  <tr key={h.key}>
                    <td>{host}</td>
                    <td>{route}</td>
                    <td className={rate >= 0.5 ? 'good' : 'bad'}>
                      {Math.round(h.ok)}✓ {Math.round(h.fail)}✗
                    </td>
                    <td>{h.ms ? `${h.ms} ms` : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      ) : null}
      <div className="debug-actions">
        <button className="btn small" onClick={copy} type="button">
          Copiar registro
        </button>
        <button className="btn small" onClick={() => clearDebug()} type="button">
          Limpiar
        </button>
        <button
          className="btn small"
          onClick={() => {
            resetRouteHealth()
            force((n) => n + 1)
          }}
          type="button"
        >
          Olvidar rutas
        </button>
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
