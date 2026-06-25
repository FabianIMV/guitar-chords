/**
 * Guitar chord fingering shapes for the diagram view.
 *
 * Strings are ordered low-E -> high-E (6 -> 1). A fret number of -1 means the
 * string is muted, 0 means open. We keep a dictionary of nice open-position
 * shapes and compute movable barre shapes for everything else, so virtually
 * any major / minor / 7 / m7 / maj7 chord gets a usable diagram.
 */

export interface ChordShape {
  frets: number[] // length 6, low E first; -1 = muted, 0 = open
  /** Lowest fret shown in the diagram window (1 = nut region). */
  baseFret: number
  /** Fret of a barre across all strings, if any (absolute fret number). */
  barre?: number
  approximate?: boolean
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_TO_SHARP: Record<string, string> = {
  Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#',
}

function noteIndex(root: string): number {
  const norm = FLAT_TO_SHARP[root] ?? root
  return NOTES.indexOf(norm)
}

// Curated open-position shapes (the ones that sound best on guitar).
const OPEN: Record<string, number[]> = {
  C: [-1, 3, 2, 0, 1, 0],
  C7: [-1, 3, 2, 3, 1, 0],
  Cmaj7: [-1, 3, 2, 0, 0, 0],
  Cm: [-1, 3, 5, 5, 4, 3],
  D: [-1, -1, 0, 2, 3, 2],
  D7: [-1, -1, 0, 2, 1, 2],
  Dm: [-1, -1, 0, 2, 3, 1],
  Dm7: [-1, -1, 0, 2, 1, 1],
  Dmaj7: [-1, -1, 0, 2, 2, 2],
  E: [0, 2, 2, 1, 0, 0],
  E7: [0, 2, 0, 1, 0, 0],
  Em: [0, 2, 2, 0, 0, 0],
  Em7: [0, 2, 0, 0, 0, 0],
  Emaj7: [0, 2, 1, 1, 0, 0],
  F: [1, 3, 3, 2, 1, 1],
  Fmaj7: [-1, -1, 3, 2, 1, 0],
  G: [3, 2, 0, 0, 0, 3],
  G7: [3, 2, 0, 0, 0, 1],
  Gmaj7: [3, 2, 0, 0, 0, 2],
  A: [-1, 0, 2, 2, 2, 0],
  A7: [-1, 0, 2, 0, 2, 0],
  Am: [-1, 0, 2, 2, 1, 0],
  Am7: [-1, 0, 2, 0, 1, 0],
  Amaj7: [-1, 0, 2, 1, 2, 0],
  B7: [-1, 2, 1, 2, 0, 2],
}

// Movable shape offsets (relative to the barre fret). 6th-string root (E-shape)
// and 5th-string root (A-shape). -1 = muted.
const E_SHAPE: Record<string, number[]> = {
  major: [0, 2, 2, 1, 0, 0],
  minor: [0, 2, 2, 0, 0, 0],
  '7': [0, 2, 0, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
}
const A_SHAPE: Record<string, number[]> = {
  major: [-1, 0, 2, 2, 2, 0],
  minor: [-1, 0, 2, 2, 1, 0],
  '7': [-1, 0, 2, 0, 2, 0],
  m7: [-1, 0, 2, 0, 1, 0],
  maj7: [-1, 0, 2, 1, 2, 0],
}

type Quality = keyof typeof E_SHAPE

function parseChord(name: string): { root: string; quality: Quality; exact: string } | null {
  const m = name.match(/^([A-G][#b]?)(.*)$/)
  if (!m) return null
  const root = m[1]
  const rest = m[2]
  let quality: Quality = 'major'
  if (/^maj7|^M7/.test(rest)) quality = 'maj7'
  else if (/^m7|^min7/.test(rest)) quality = 'm7'
  else if (/^(m|min)(?!aj)/.test(rest)) quality = 'minor'
  else if (/^7|^dom7/.test(rest)) quality = '7'
  return { root, quality, exact: name }
}

function applyOffsets(offsets: number[], barre: number): number[] {
  return offsets.map((o) => (o < 0 ? -1 : o + barre))
}

export function getChordShape(name: string): ChordShape | null {
  const clean = name.trim()
  if (OPEN[clean]) {
    const frets = OPEN[clean]
    const played = frets.filter((f) => f > 0)
    return { frets, baseFret: played.length ? Math.min(...played) : 1 }
  }

  const parsed = parseChord(clean)
  if (!parsed) return null
  const ri = noteIndex(parsed.root)
  if (ri < 0) return null

  // Fret of the root on 6th string (open = E, index 4) and 5th string (open = A, index 9).
  const fret6 = (((ri - 4) % 12) + 12) % 12
  const fret5 = (((ri - 9) % 12) + 12) % 12

  // Prefer whichever barre sits at a lower, more playable fret.
  const useA = fret5 > 0 && (fret5 <= fret6 || fret6 === 0)
  const barre = useA ? fret5 : fret6 === 0 ? 12 : fret6
  const offsets = useA ? A_SHAPE[parsed.quality] : E_SHAPE[parsed.quality]
  const frets = applyOffsets(offsets, barre)
  const played = frets.filter((f) => f > 0)

  // The unknown-suffix chords (sus, dim, add...) are rendered as their triad.
  const approximate = !/^(maj7|m7|min7|m|min|7|dom7|M7)?$/.test(parsed.exact.replace(/^[A-G][#b]?/, ''))

  return {
    frets,
    baseFret: played.length ? Math.min(...played) : 1,
    barre,
    approximate,
  }
}
