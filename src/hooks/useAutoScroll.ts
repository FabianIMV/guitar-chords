import { useEffect, useRef, useState } from 'react'

/**
 * Smooth hands-free auto-scroll for reading a chord sheet while playing.
 * Speed is 1..10; uses requestAnimationFrame for a steady pixel rate.
 */
export function useAutoScroll() {
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(3)
  const speedRef = useRef(speed)
  speedRef.current = speed

  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = performance.now()
    let remainder = 0

    const tick = (now: number) => {
      const dt = now - last
      last = now
      // pixels/second scales with speed
      const pxPerSec = speedRef.current * 14
      remainder += (pxPerSec * dt) / 1000
      const whole = Math.floor(remainder)
      if (whole > 0) {
        window.scrollBy(0, whole)
        remainder -= whole
        // Stop at the bottom of the page.
        if (
          window.innerHeight + window.scrollY >=
          document.body.scrollHeight - 2
        ) {
          setRunning(false)
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running])

  return { running, setRunning, speed, setSpeed }
}
