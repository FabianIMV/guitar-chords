import { useEffect } from 'react'

interface Sentinel {
  release(): Promise<void>
  addEventListener(type: 'release', fn: () => void): void
}

/**
 * Keep the screen on while `active` (Screen Wake Lock API; iOS 16.4+,
 * Android Chrome). The lock is dropped by the OS when the app is hidden, so
 * it's re-acquired when the page becomes visible again.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } }).wakeLock
    if (!active || !wl) return
    let sentinel: Sentinel | null = null
    let cancelled = false

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || sentinel) return
      try {
        const s = await wl.request('screen')
        if (cancelled) {
          s.release().catch(() => {})
          return
        }
        sentinel = s
        s.addEventListener('release', () => {
          sentinel = null
        })
      } catch {
        /* not allowed (e.g. low battery mode) */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire()
    }
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      sentinel?.release().catch(() => {})
      sentinel = null
    }
  }, [active])
}
