/**
 * Lightweight in-app debug log so problems are visible on the phone (where we
 * have no devtools). Every network attempt and search result is recorded and
 * shown in the Debug panel; the user can copy the whole log to share.
 */

export interface DebugEntry {
  ts: number
  kind: 'fetch' | 'source' | 'info' | 'error'
  label: string
  detail?: string
  ms?: number
  ok?: boolean
}

const MAX = 200
let entries: DebugEntry[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function logDebug(e: Omit<DebugEntry, 'ts'>) {
  entries.push({ ...e, ts: Date.now() })
  if (entries.length > MAX) entries = entries.slice(-MAX)
  emit()
}

export function getDebug(): DebugEntry[] {
  return entries
}

export function clearDebug() {
  entries = []
  emit()
}

export function subscribeDebug(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function formatDebug(): string {
  const lines = entries.map((e) => {
    const t = new Date(e.ts).toLocaleTimeString()
    const ms = e.ms != null ? ` ${e.ms}ms` : ''
    const ok = e.ok == null ? '' : e.ok ? ' ✓' : ' ✗'
    return `[${t}] ${e.kind.toUpperCase()}${ok}${ms} ${e.label}${e.detail ? ' — ' + e.detail : ''}`
  })
  return lines.join('\n')
}
