import { chordDifficulty } from './chordShapes'
import { detectKey, keyUsesFlats, noteIndex, parseKey, transposeChord, transposeKey } from './chords'

/**
 * Key/capo helpers built on top of the chord grammar and shape library.
 *
 * Model: `steps` changes the key the song SOUNDS in (for the singer);
 * `capo` keeps that sound but shows easier shapes, so the sheet displays
 * chords shifted by (steps - capo).
 */

export function shapeShift(steps: number, capo: number): number {
  return steps - capo
}

/** Accidental spelling for the displayed shapes, from the shape key. */
export function displayFlats(key: string | undefined, shift: number): boolean | undefined {
  if (!key) return undefined
  return keyUsesFlats(transposeKey(key, shift))
}

export function sheetDifficulty(chords: string[], shift: number, flats?: boolean): number {
  let total = 0
  for (const c of chords) total += chordDifficulty(transposeChord(c, shift, flats))
  return total
}

export interface CapoSuggestion {
  capo: number
  /** Key of the shapes you'd play with that capo (e.g. "G"). */
  shapesKey?: string
  /** How much easier than the current capo (difficulty points saved). */
  gain: number
}

/**
 * The capo position (0–7) whose shapes are easiest to play while keeping
 * the sounding key. Only suggested when it's clearly easier than `current`.
 */
export function suggestCapo(
  chords: string[],
  steps: number,
  current: number,
  key?: string
): CapoSuggestion | null {
  if (chords.length === 0) return null
  const score = (capo: number) => {
    const shift = shapeShift(steps, capo)
    const flats = key ? keyUsesFlats(transposeKey(key, shift)) : undefined
    // Small penalty per fret: a capo is a mild inconvenience.
    return sheetDifficulty(chords, shift, flats) + capo * 0.25
  }
  const now = score(current)
  let best = current
  let bestScore = now
  for (let capo = 0; capo <= 7; capo++) {
    const s = score(capo)
    if (s < bestScore - 0.01) {
      best = capo
      bestScore = s
    }
  }
  const gain = now - bestScore
  if (best === current || gain < 1.5) return null
  return {
    capo: best,
    shapesKey: key ? transposeKey(key, shapeShift(steps, best)) : undefined,
    gain,
  }
}

/**
 * Key of the chords as written on the sheet. Sources report the song's key
 * inconsistently (UG gives the sounding key even when the sheet is written
 * for a capo), so we cross-check it with the key detected from the chords.
 */
export function resolveWrittenKey(
  chords: string[],
  sourceKey: string | undefined,
  sourceCapo: number
): string | undefined {
  const detected = detectKey(chords) ?? undefined
  if (!sourceKey || !parseKey(sourceKey)) return detected
  const own = transposeKey(sourceKey, 0)
  if (sourceCapo > 0) {
    // Either the sounding key (UG) or already the key of the shapes.
    const shapes = transposeKey(sourceKey, -sourceCapo)
    if (detected && !sameTonality(shapes, detected) && sameTonality(own, detected)) return own
    return shapes
  }
  // Major vs relative minor is ambiguous from chords alone: the site knows.
  return own
}

/** Same key or its relative major/minor (they share the same chords). */
function sameTonality(a: string, b: string): boolean {
  const ka = parseKey(a)
  const kb = parseKey(b)
  if (!ka || !kb) return false
  const ia = noteIndex(ka.root)
  const ib = noteIndex(kb.root)
  if (ka.minor === kb.minor) return ia === ib
  // relative minor is 3 semitones below its major
  return ka.minor ? (ia + 3) % 12 === ib : (ib + 3) % 12 === ia
}
