import { useEffect, useSyncExternalStore } from 'react'

/** Minimal global toast: one message at a time, optional action (undo). */

interface ToastState {
  id: number
  text: string
  action?: { label: string; run: () => void }
}

let state: ToastState | null = null
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function toast(text: string, action?: ToastState['action']) {
  state = { id: ++seq, text, action }
  emit()
}

function dismiss(id: number) {
  if (state?.id === id) {
    state = null
    emit()
  }
}

export function ToastHost() {
  const t = useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => state
  )
  useEffect(() => {
    if (!t) return
    const timer = setTimeout(() => dismiss(t.id), t.action ? 5000 : 2600)
    return () => clearTimeout(timer)
  }, [t])
  if (!t) return null
  return (
    <div className="toast" role="status" key={t.id}>
      <span>{t.text}</span>
      {t.action ? (
        <button
          type="button"
          onClick={() => {
            t.action!.run()
            dismiss(t.id)
          }}
        >
          {t.action.label}
        </button>
      ) : null}
    </div>
  )
}
