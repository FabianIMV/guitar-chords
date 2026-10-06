import { useEffect, useRef, useState } from 'react'
import { SCROLL_SPEED_MAX, SCROLL_SPEED_MIN } from '../lib/storage'

/** Pixels per second for a speed value (speed is a 0.3–10 multiplier). */
export const PX_PER_SPEED = 12

/**
 * Smooth hands-free auto-scroll for reading a chord sheet while playing.
 * - requestAnimationFrame with sub-pixel accumulation for a steady rate,
 * - pauses while a finger is on the screen and resumes shortly after, so
 *   adjusting the position by hand doesn't fight the scroller,
 * - stops at the end of the page.
 */
export function useAutoScroll(initialSpeed: number, onSpeedChange?: (s: number) => void) {
  const [running, setRunning] = useState(false)
  const [speed, setSpeedState] = useState(initialSpeed)
  const [held, setHeld] = useState(false)
  const speedRef = useRef(speed)
  speedRef.current = speed
  const heldRef = useRef(false)

  const setSpeed = (next: number) => {
    const v = Math.round(Math.min(SCROLL_SPEED_MAX, Math.max(SCROLL_SPEED_MIN, next)) * 10) / 10
    setSpeedState(v)
    onSpeedChange?.(v)
  }

  // Reset when the song (and so its remembered speed) changes.
  useEffect(() => {
    setSpeedState(initialSpeed)
    setRunning(false)
  }, [initialSpeed])

  useEffect(() => {
    if (!running) return
    let resumeTimer: ReturnType<typeof setTimeout> | undefined
    // Touches on controls (toolbar, sheets, player) don't pause scrolling.
    const onControls = (e: Event) =>
      !!(e.target as Element | null)?.closest?.('.toolbar, .modal, .mini-player, .speedbar')
    const down = (e?: Event) => {
      if (e && onControls(e)) return
      clearTimeout(resumeTimer)
      heldRef.current = true
      setHeld(true)
    }
    const up = (e?: Event) => {
      if (e && onControls(e) && !heldRef.current) return
      clearTimeout(resumeTimer)
      resumeTimer = setTimeout(() => {
        heldRef.current = false
        setHeld(false)
      }, 1200)
    }
    window.addEventListener('touchstart', down, { passive: true })
    window.addEventListener('touchend', up, { passive: true })
    window.addEventListener('touchcancel', up, { passive: true })
    const wheel = () => {
      down()
      up()
    }
    window.addEventListener('wheel', wheel, { passive: true })

    let raf = 0
    let last = performance.now()
    let remainder = 0
    const tick = (now: number) => {
      const dt = Math.min(100, now - last)
      last = now
      if (!heldRef.current) {
        remainder += (speedRef.current * PX_PER_SPEED * dt) / 1000
        const whole = Math.floor(remainder)
        if (whole > 0) {
          window.scrollBy(0, whole)
          remainder -= whole
          const bottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
          if (bottom) {
            setRunning(false)
            return
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(resumeTimer)
      heldRef.current = false
      setHeld(false)
      window.removeEventListener('touchstart', down)
      window.removeEventListener('touchend', up)
      window.removeEventListener('touchcancel', up)
      window.removeEventListener('wheel', wheel)
    }
  }, [running])

  return { running, setRunning, speed, setSpeed, held }
}
