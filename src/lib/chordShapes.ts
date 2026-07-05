/**
 * Guitar chord fingering shapes for the diagram view.
 *
 * Strings are ordered low-E -> high-E (6 -> 1). A fret number of -1 means the
 * string is muted, 0 means open. Strategy:
 *   1. curated open-position shapes (they sound best),
 *   2. movable barre shapes (E-form / A-form) for common qualities,
 *   3. special 5th-string-root builders for dim / m7b5,
 *   4. anything else falls back to its closest triad, flagged approximate (≈).
 *
 * Brazilian/Spanish spellings from CifraClub & co. are normalized first:
 * "C7M" = Cmaj7, "Cº"/"C°" = Cdim, "Am7(5-)" = Am7b5, "D4" = Dsus4,
 * "A2" = Asus2, "E5+" = Eaug.
 */

export interface ChordShape {
  frets: number[] // length 6, low E first; -1 = muted, 0 = open
  /** Lowest fret shown in the diagram window (1 = nut region). */
  baseFret: number
  /** Fret of a barre across strings, if any (absolute fret number). */
  barre?: number
  approximate?: boolean
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_TO_SHARP: Record<string, string> = {
  Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#',
}

function noteIndex(root: string): number {
  return NOTES.indexOf(FLAT_TO_SHARP[root] ?? root)
}

// Curated open-position shapes (including very common barres and slash chords).
const OPEN: Record<string, number[]> = {
  C: [-1, 3, 2, 0, 1, 0],
  C7: [-1, 3, 2, 3, 1, 0],
  Cmaj7: [-1, 3, 2, 0, 0, 0],
  Cadd9: [-1, 3, 2, 0, 3, 0],
  C6: [-1, 3, 2, 2, 1, 0],
  Cm: [-1, 3, 5, 5, 4, 3],
  'C/G': [3, 3, 2, 0, 1, 0],
  D: [-1, -1, 0, 2, 3, 2],
  D7: [-1, -1, 0, 2, 1, 2],
  Dm: [-1, -1, 0, 2, 3, 1],
  Dm7: [-1, -1, 0, 2, 1, 1],
  Dmaj7: [-1, -1, 0, 2, 2, 2],
  Dsus2: [-1, -1, 0, 2, 3, 0],
  Dsus4: [-1, -1, 0, 2, 3, 3],
  'D/F#': [2, -1, 0, 2, 3, 2],
  E: [0, 2, 2, 1, 0, 0],
  E7: [0, 2, 0, 1, 0, 0],
  Em: [0, 2, 2, 0, 0, 0],
  Em7: [0, 2, 0, 0, 0, 0],
  Emaj7: [0, 2, 1, 1, 0, 0],
  Esus4: [0, 2, 2, 2, 0, 0],
  F: [1, 3, 3, 2, 1, 1],
  Fm: [1, 3, 3, 1, 1, 1],
  Fmaj7: [-1, -1, 3, 2, 1, 0],
  G: [3, 2, 0, 0, 0, 3],
  G7: [3, 2, 0, 0, 0, 1],
  Gm: [3, 5, 5, 3, 3, 3],
  Gmaj7: [3, 2, 0, 0, 0, 2],
  'G/B': [-1, 2, 0, 0, 3, 3],
  A: [-1, 0, 2, 2, 2, 0],
  A7: [-1, 0, 2, 0, 2, 0],
  Am: [-1, 0, 2, 2, 1, 0],
  Am7: [-1, 0, 2, 0, 1, 0],
  Amaj7: [-1, 0, 2, 1, 2, 0],
  Asus2: [-1, 0, 2, 2, 0, 0],
  Asus4: [-1, 0, 2, 2, 3, 0],
  A7sus4: [-1, 0, 2, 0, 3, 0],
  B7: [-1, 2, 1, 2, 0, 2],
  Bm: [-1, 2, 4, 4, 3, 2],
  Bb: [-1, 1, 3, 3, 3, 1],
  'F#m': [2, 4, 4, 2, 2, 2],
  'C#m': [-1, 4, 6, 6, 5, 4],
}

// Movable shape offsets relative to the barre fret. -1 = muted.
type Form = 'e' | 'a'
const MOVABLE: Record<string, Partial<Record<Form, number[]>>> = {
  major: { e: [0, 2, 2, 1, 0, 0], a: [-1, 0, 2, 2, 2, 0] },
  minor: { e: [0, 2, 2, 0, 0, 0], a: [-1, 0, 2, 2, 1, 0] },
  '7':   { e: [0, 2, 0, 1, 0, 0], a: [-1, 0, 2, 0, 2, 0] },
  m7:    { e: [0, 2, 0, 0, 0, 0], a: [-1, 0, 2, 0, 1, 0] },
  maj7:  { e: [0, 2, 1, 1, 0, 0], a: [-1, 0, 2, 1, 2, 0] },
  sus4:  { e: [0, 2, 2, 2, 0, 0], a: [-1, 0, 2, 2, 3, 0] },
  sus2:  { a: [-1, 0, 2, 2, 0, 0] },
  '7sus4': { e: [0, 2, 0, 2, 0, 0], a: [-1, 0, 2, 0, 3, 0] },
}

type Quality = keyof typeof MOVABLE | 'dim' | 'm7b5'

/** Normalize suffix spellings to canonical tokens. */
function normalizeSuffix(rest: string): string {
  let s = rest.trim()
  s = s.replace(/\(([^)]*)\)/g, '$1') // m7(5-) -> m75-
  s = s.replace(/º|°|ø/g, 'dim')
  s = s.replace(/7M|M7|Maj7/g, 'maj7')
  s = s.replace(/5-/g, 'b5')
  s = s.replace(/5\+|aug/g, 'aug')
  return s
}

interface Parsed {
  root: string
  quality: Quality
  approximate: boolean
}

function parseChord(name: string): Parsed | null {
  const m = name.match(/^([A-G][#b]?)(.*)$/)
  if (!m) return null
  const root = m[1]
  const s = normalizeSuffix(m[2])

  let quality: Quality
  let exact = true
  if (/^maj7/.test(s)) quality = 'maj7'
  else if (/^m7.*b5|^mb5/.test(s)) quality = 'm7b5'
  else if (/^dim/.test(s)) quality = 'dim'
  else if (/^(m|min)7/.test(s)) quality = 'm7'
  else if (/^(m|min)(?!aj)/.test(s)) quality = 'minor'
  else if (/^7sus4?/.test(s)) quality = '7sus4'
  else if (/^sus4|^4/.test(s)) quality = 'sus4'
  else if (/^sus2|^2/.test(s)) quality = 'sus2'
  else if (/^(7|9|11|13)/.test(s)) {
    quality = '7' // 9/11/13 contain the dominant 7; close enough for a diagram
    exact = /^7$/.test(s)
  } else if (/^aug/.test(s)) {
    quality = 'major'
    exact = false
  } else if (s === '' || /^(add9|6|5)$/.test(s)) {
    quality = 'major'
    exact = s === ''
  } else {
    quality = 'major'
    exact = false
  }

  // Leftover decorations (e.g. "m7b5" handled, but "maj7#11" isn't) => approx.
  const clean = /^(maj7|m7b5|dim7?|m7|min7|m|min|7sus4|sus4|sus2|4|2|7|9|11|13|aug|add9|6|5)?$/.test(s)
  return { root, quality, approximate: exact ? !clean : true }
}

function shapeFromFrets(frets: number[], barre?: number, approximate?: boolean): ChordShape {
  const played = frets.filter((f) => f > 0)
  return {
    frets,
    baseFret: played.length ? Math.min(...played) : 1,
    barre,
    approximate: approximate || undefined,
  }
}

/** dim7 / m7b5 with the root on the 5th string. */
function fifthStringShape(rootIdx: number, quality: 'dim' | 'm7b5'): ChordShape {
  let r = (((rootIdx - 9) % 12) + 12) % 12 // fret of root on A string
  if (r === 0) r = 12
  if (quality === 'dim' && r < 2) r += 12
  const frets =
    quality === 'dim'
      ? [-1, r, r + 1, r - 1, r + 1, -1]
      : [-1, r, r + 1, r, r + 1, -1]
  return shapeFromFrets(frets)
}

export function getChordShape(name: string): ChordShape | null {
  const clean = name.trim()
  // Exact open shape (also try the main part of slash chords).
  const openKey = OPEN[clean] ? clean : undefined
  if (openKey) return shapeFromFrets(OPEN[openKey])

  const main = clean.split('/')[0]
  const parsed = parseChord(main)
  if (!parsed) return null
  const ri = noteIndex(parsed.root)
  if (ri < 0) return null

  // Slash chord with no dedicated shape: show the main chord, flagged ≈.
  const slashApprox = clean.includes('/') && !OPEN[clean]

  // Open shape for the normalized main chord (e.g. "C7M" -> "Cmaj7").
  const openNames: Record<string, string> = {
    major: parsed.root, minor: parsed.root + 'm', '7': parsed.root + '7',
    m7: parsed.root + 'm7', maj7: parsed.root + 'maj7',
    sus2: parsed.root + 'sus2', sus4: parsed.root + 'sus4',
    '7sus4': parsed.root + '7sus4',
  }
  const alias = openNames[parsed.quality]
  if (alias && OPEN[alias]) {
    return shapeFromFrets(OPEN[alias], undefined, parsed.approximate || slashApprox)
  }

  if (parsed.quality === 'dim' || parsed.quality === 'm7b5') {
    const s = fifthStringShape(ri, parsed.quality)
    s.approximate = parsed.approximate || slashApprox || undefined
    return s
  }

  const forms = MOVABLE[parsed.quality]
  if (!forms) return null

  // Root fret on 6th string (E) and 5th string (A).
  const fret6raw = (((ri - 4) % 12) + 12) % 12
  const fret5 = (((ri - 9) % 12) + 12) % 12
  const fret6 = fret6raw === 0 ? 12 : fret6raw

  // Choose the playable form with the lowest position (A-form may be open).
  const candidates: Array<{ offsets: number[]; barre: number }> = []
  if (forms.a) candidates.push({ offsets: forms.a, barre: fret5 })
  if (forms.e) candidates.push({ offsets: forms.e, barre: fret6 })
  candidates.sort((x, y) => x.barre - y.barre)
  const pick = candidates[0]
  if (!pick) return null

  const frets = pick.offsets.map((o) => (o < 0 ? -1 : o + pick.barre))
  return shapeFromFrets(
    frets,
    pick.barre > 0 ? pick.barre : undefined,
    parsed.approximate || slashApprox
  )
}
