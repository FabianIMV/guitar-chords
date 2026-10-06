import { useEffect, useRef, useState } from 'react'
import type { SourceId } from '../sources/types'
import { SEARCHABLE, sourceLabel } from '../sources'
import { pingBackend, type PingResult } from '../lib/proxy'
import { DEFAULT_BACKEND, FONT_MAX, FONT_MIN, getBackendUrl, setBackendUrl, setPrefs } from '../lib/settings'
import { clearSongCache, exportBackup, importBackup, requestPersistence } from '../lib/storage'
import { usePrefs } from '../hooks/useStores'
import { DebugPanel } from './DebugPanel'
import { Icon } from './Icon'
import { Segmented, Toggle } from './SongModals'
import { toast } from './Toast'

const SOURCE_NOTES: Record<string, string> = {
  cifraclub: 'Catálogo enorme (Brasil, mucho en español)',
  'ultimate-guitar': 'Valoraciones y muchas versiones',
  lacuerda: 'Repertorio en español',
  tusacordes: 'En español, notación Do-Re-Mi',
}

export function SettingsPage() {
  const prefs = usePrefs()
  const [backend, setBackend] = useState(getBackendUrl())
  const [ping, setPing] = useState<PingResult | null>(null)
  const [pinging, setPinging] = useState(false)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null))
  }, [])

  const toggleSource = (id: SourceId, on: boolean) => {
    const next = on ? [...new Set([...prefs.sources, id])] : prefs.sources.filter((s) => s !== id)
    if (next.length === 0) {
      toast('Deja al menos una fuente activa')
      return
    }
    setPrefs({ sources: SEARCHABLE.filter((s) => next.includes(s)) })
  }

  const test = async () => {
    setBackendUrl(backend)
    if (!backend.trim()) {
      setPing(null)
      toast('Backend desactivado')
      return
    }
    setPinging(true)
    setPing(await pingBackend(backend.trim()))
    setPinging(false)
  }

  const doExport = () => {
    const blob = new Blob([exportBackup()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `acordes-copia-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  const doImport = async (file: File) => {
    try {
      const { favorites } = importBackup(await file.text())
      toast(`Copia restaurada: ${favorites} favoritos`)
      setTimeout(() => location.reload(), 800)
    } catch (e) {
      toast(String((e as Error)?.message || e))
    }
  }

  return (
    <div className="page settings-page">
      <header className="page-header">
        <div className="brand">Ajustes</div>
      </header>
      <main className="page-body">
        <section className="card">
          <h2 className="section-title">Lectura</h2>
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
          <div className="opt-row">
            <span className="opt-label">
              <Icon name="text" /> Tamaño de letra
            </span>
            <div className="stepper">
              <button type="button" onClick={() => setPrefs({ fontSize: Math.max(FONT_MIN, prefs.fontSize - 1) })} aria-label="Reducir">
                <Icon name="minus" />
              </button>
              <span>{prefs.fontSize}</span>
              <button type="button" onClick={() => setPrefs({ fontSize: Math.min(FONT_MAX, prefs.fontSize + 1) })} aria-label="Aumentar">
                <Icon name="plus" />
              </button>
            </div>
          </div>
          <div className="opt-row">
            <span className="opt-label">
              <Icon name={prefs.theme === 'light' ? 'sun' : 'moon'} /> Tema
            </span>
            <Segmented
              value={prefs.theme}
              options={[
                ['auto', 'Auto'],
                ['dark', 'Oscuro'],
                ['light', 'Claro'],
              ]}
              onChange={(v) => setPrefs({ theme: v })}
            />
          </div>
          <Toggle icon="grid" label="Diagramas de acordes" value={prefs.showDiagrams} onChange={(v) => setPrefs({ showDiagrams: v })} />
          <Toggle
            icon="sun"
            label="Pantalla siempre encendida"
            hint="Mientras tengas una canción abierta"
            value={prefs.keepAwake}
            onChange={(v) => setPrefs({ keepAwake: v })}
          />
        </section>

        <section className="card">
          <h2 className="section-title">Fuentes de búsqueda</h2>
          {SEARCHABLE.map((id) => (
            <Toggle
              key={id}
              label={sourceLabel(id)}
              hint={SOURCE_NOTES[id]}
              value={prefs.sources.includes(id)}
              onChange={(on) => toggleSource(id, on)}
            />
          ))}
        </section>

        <section className="card">
          <h2 className="section-title">Backend propio (Cloudflare Worker)</h2>
          <p className="hint small">
            Hace que los sitios respondan rápido y sin bloqueos. Si un sitio lo rechaza, la app usa Jina automáticamente.
            Cómo crearlo: <code>worker/README.md</code>.
          </p>
          <div className="backend-row">
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
            <button className="btn primary" type="button" onClick={test} disabled={pinging}>
              {pinging ? 'Probando…' : 'Probar'}
            </button>
          </div>
          {ping ? (
            <p className={`ping ${ping.ok ? 'good' : 'bad'}`}>
              {ping.ok ? (
                <>
                  <Icon name="check" size={16} /> Responde en {ping.ms} ms · versión {ping.version}
                  {ping.version && ping.version < 2 ? ' — actualízalo a la v2 (worker/worker.js) para Ultimate Guitar y LaCuerda más rápidos.' : ''}
                </>
              ) : (
                <>
                  <Icon name="x" size={16} /> No responde ({ping.error})
                </>
              )}
            </p>
          ) : null}
          {backend !== DEFAULT_BACKEND ? (
            <button
              className="btn subtle"
              type="button"
              onClick={() => {
                setBackend(DEFAULT_BACKEND)
                setBackendUrl(DEFAULT_BACKEND)
                setPing(null)
              }}
            >
              Usar el backend por defecto
            </button>
          ) : null}
        </section>

        <section className="card">
          <h2 className="section-title">Tus datos</h2>
          <p className="hint small">
            Favoritos, tonos y ajustes se guardan solo en este dispositivo.
            {persisted === false ? ' El navegador podría borrarlos si no usas la app en semanas: instálala en la pantalla de inicio o haz una copia.' : ''}
          </p>
          <div className="row-actions">
            <button className="btn" type="button" onClick={doExport}>
              <Icon name="download" size={18} /> Exportar copia
            </button>
            <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={18} /> Importar
            </button>
            {persisted === false ? (
              <button
                className="btn"
                type="button"
                onClick={async () => {
                  const ok = await requestPersistence()
                  setPersisted(ok)
                  toast(ok ? 'Almacenamiento protegido' : 'El navegador no lo permitió')
                }}
              >
                Proteger datos
              </button>
            ) : null}
            <button
              className="btn subtle"
              type="button"
              onClick={() => {
                clearSongCache()
                toast('Caché de canciones borrada')
              }}
            >
              Borrar caché
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) doImport(f)
              e.target.value = ''
            }}
          />
        </section>

        <section className="card">
          <button className="disclosure" type="button" onClick={() => setShowDebug((v) => !v)} aria-expanded={showDebug}>
            <span>
              <Icon name="bug" /> Diagnóstico
            </span>
            <Icon name={showDebug ? 'up' : 'down'} />
          </button>
          {showDebug ? <DebugPanel /> : null}
        </section>

        <p className="about">
          Acordes · build {__BUILD_DATE__}
          <br />
          Contenido de CifraClub, Ultimate Guitar, LaCuerda y TusAcordes; los derechos son de sus autores.
        </p>
      </main>
    </div>
  )
}
