/**
 * Guitar chord fingering shapes for the diagram view.
 *
 * Strings are ordered low-E -> high-E (6 -> 1). A fret of -1 means the
 * string is muted, 0 means open. Strategy:
 *   1. curated open-position shapes (they sound best),
 *   2. movable shapes (E-form / A-form barres, dim7, m7b5, aug, power),
 *   3. anything else falls back to its closest simpler chord, flagged
 *      approximate (≈).
 *
 * Brazilian/Spanish spellings are normalized first: "C7M" = Cmaj7,
 * "Cº"/"C°" = Cdim, "Am7(5-)" = Am7b5, "D4" = Dsus4, "A2" = Asus2,
 * "E5+" = Eaug, "C7(9)" = C9.
 */

import { noteIndex, parseChord } from './chords'

export interface ChordShape {
  frets: number[] // length 6, low E first; -1 = muted, 0 = open
  /** First fret shown in the diagram window (1 = nut visible). */
  baseFret: number
  /** Barre: absolute fret and the string span it covers (0-based). */
  barre?: { fret: number; from: number; to: number }
  approximate?: boolean
}

// Curated open-position shapes (including common barres and slash chords).
const OPEN: Record<string, number[]> = {
  C: [-1, 3, 2, 0, 1, 0],
  C7: [-1, 3, 2, 3, 1, 0],
  Cmaj7: [-1, 3, 2, 0, 0, 0],
  Cadd9: [-1, 3, 2, 0, 3, 0],
  C6: [-1, 3, 2, 2, 1, 0],
  C9: [-1, 3, 2, 3, 3, 3],
  Csus2: [-1, 3, 0, 0, 1, 3],
  Csus4: [-1, 3, 3, 0, 1, 1],
  Cm: [-1, 3, 5, 5, 4, 3],
  Cm7: [-1, 3, 5, 3, 4, 3],
  'C/G': [3, 3, 2, 0, 1, 0],
  'C/E': [0, 3, 2, 0, 1, 0],
  'C/B': [-1, 2, 2, 0, 1, 0],
  'C#m': [-1, 4, 6, 6, 5, 4],
  'C#m7': [-1, 4, 6, 4, 5, 4],
  D: [-1, -1, 0, 2, 3, 2],
  D7: [-1, -1, 0, 2, 1, 2],
  D6: [-1, -1, 0, 2, 0, 2],
  Dm: [-1, -1, 0, 2, 3, 1],
  Dm7: [-1, -1, 0, 2, 1, 1],
  Dmaj7: [-1, -1, 0, 2, 2, 2],
  Dsus2: [-1, -1, 0, 2, 3, 0],
  Dsus4: [-1, -1, 0, 2, 3, 3],
  D7sus4: [-1, -1, 0, 2, 1, 3],
  'D/F#': [2, -1, 0, 2, 3, 2],
  'D/A': [-1, 0, 0, 2, 3, 2],
  'D/C': [-1, 3, 0, 2, 3, 2],
  E: [0, 2, 2, 1, 0, 0],
  E7: [0, 2, 0, 1, 0, 0],
  E6: [0, 2, 2, 1, 2, 0],
  Em: [0, 2, 2, 0, 0, 0],
  Em7: [0, 2, 0, 0, 0, 0],
  Em6: [0, 2, 2, 0, 2, 0],
  Emaj7: [0, 2, 1, 1, 0, 0],
  Esus4: [0, 2, 2, 2, 0, 0],
  E7sus4: [0, 2, 0, 2, 0, 0],
  'Em/D': [-1, -1, 0, 0, 0, 0],
  'Em/B': [-1, 2, 2, 0, 0, 0],
  F: [1, 3, 3, 2, 1, 1],
  F7: [1, 3, 1, 2, 1, 1],
  Fm: [1, 3, 3, 1, 1, 1],
  Fm7: [1, 3, 1, 1, 1, 1],
  Fmaj7: [-1, -1, 3, 2, 1, 0],
  Fsus2: [-1, -1, 3, 0, 1, 1],
  'F/A': [-1, 0, 3, 2, 1, 1],
  'F/C': [-1, 3, 3, 2, 1, 1],
  'F#': [2, 4, 4, 3, 2, 2],
  'F#7': [2, 4, 2, 3, 2, 2],
  'F#m': [2, 4, 4, 2, 2, 2],
  'F#m7': [2, 4, 2, 2, 2, 2],
  G: [3, 2, 0, 0, 0, 3],
  G7: [3, 2, 0, 0, 0, 1],
  G6: [3, 2, 0, 0, 0, 0],
  Gm: [3, 5, 5, 3, 3, 3],
  Gm7: [3, 5, 3, 3, 3, 3],
  Gmaj7: [3, 2, 0, 0, 0, 2],
  Gsus4: [3, 3, 0, 0, 1, 3],
  'G/B': [-1, 2, 0, 0, 3, 3],
  'G/D': [-1, -1, 0, 0, 0, 3],
  'G/F#': [2, -1, 0, 0, 3, 3],
  'G#m': [4, 6, 6, 4, 4, 4],
  A: [-1, 0, 2, 2, 2, 0],
  A7: [-1, 0, 2, 0, 2, 0],
  A6: [-1, 0, 2, 2, 2, 2],
  A5: [-1, 0, 2, 2, -1, -1],
  Am: [-1, 0, 2, 2, 1, 0],
  Am7: [-1, 0, 2, 0, 1, 0],
  Am6: [-1, 0, 2, 2, 1, 2],
  Amaj7: [-1, 0, 2, 1, 2, 0],
  Aadd9: [-1, 0, 2, 4, 2, 0],
  Asus2: [-1, 0, 2, 2, 0, 0],
  Asus4: [-1, 0, 2, 2, 3, 0],
  A7sus4: [-1, 0, 2, 0, 3, 0],
  'A/C#': [-1, 4, 2, 2, 2, 0],
  'A/E': [0, 0, 2, 2, 2, 0],
  'A/G': [3, -1, 2, 2, 2, 0],
  'Am/G': [3, 0, 2, 2, 1, 0],
  'Am/C': [-1, 3, 2, 2, 1, 0],
  'Am/E': [0, 0, 2, 2, 1, 0],
  'Am/F#': [2, 0, 2, 2, 1, 0],
  B: [-1, 2, 4, 4, 4, 2],
  B7: [-1, 2, 1, 2, 0, 2],
  Bm: [-1, 2, 4, 4, 3, 2],
  Bm7: [-1, 2, 0, 2, 0, 2],
  'Bm/A': [-1, 0, 4, 4, 3, 2],
  Bb: [-1, 1, 3, 3, 3, 1],
  Bb7: [-1, 1, 3, 1, 3, 1],
  Bbmaj7: [-1, 1, 3, 2, 3, 1],
  Bbm: [-1, 1, 3, 3, 2, 1],
  Eb: [-1, 6, 5, 3, 4, 3],
}

// Movable shapes as offsets from the root fret on the 6th (e) or 5th (a)
// string. null = muted string; offsets may be negative.
type Offsets = Array<number | null>
type Form = 'e' | 'a'
type Quality =
  | 'major' | 'minor' | '7' | 'm7' | 'maj7' | 'sus4' | 'sus2' | '7sus4'
  | '9' | 'dim' | 'm7b5' | 'aug' | '5'

const MOVABLE: Record<Quality, Partial<Record<Form, Offsets>>> = {
  major: { e: [0, 2, 2, 1, 0, 0], a: [null, 0, 2, 2, 2, 0] },
  minor: { e: [0, 2, 2, 0, 0, 0], a: [null, 0, 2, 2, 1, 0] },
  '7': { e: [0, 2, 0, 1, 0, 0], a: [null, 0, 2, 0, 2, 0] },
  m7: { e: [0, 2, 0, 0, 0, 0], a: [null, 0, 2, 0, 1, 0] },
  maj7: { e: [0, null, 1, 1, 0, null], a: [null, 0, 2, 1, 2, 0] },
  sus4: { e: [0, 2, 2, 2, 0, 0], a: [null, 0, 2, 2, 3, 0] },
  sus2: { a: [null, 0, 2, 2, 0, 0] },
  '7sus4': { e: [0, 2, 0, 2, 0, 0], a: [null, 0, 2, 0, 3, 0] },
  '9': { a: [null, 0, -1, 0, 0, 0] },
  dim: { e: [0, null, -1, 0, -1, null], a: [null, 0, 1, -1, 1, null] },
  m7b5: { e: [0, null, 0, 0, -1, null], a: [null, 0, 1, 0, 1, null] },
  aug: { e: [0, 3, 2, 1, 1, 0], a: [null, 0, -1, -2, -2, null] },
  '5': { e: [0, 2, 2, null, null, null], a: [null, 0, 2, 2, null, null] },
}

/** Normalize suffix spellings to canonical tokens. */
function normalizeSuffix(rest: string): string {
  let s = rest.trim()
  s = s.replace(/\(([^)]*)\)/g, '$1') // m7(5-) -> m75-, 7(9) -> 79
  s = s.replace(/º|°/g, 'dim')
  s = s.replace(/ø/g, 'm7b5')
  s = s.replace(/^7\+$/, 'maj7') // Brazilian "C7+" = Cmaj7
  s = s.replace(/7M|M7|Maj7|maj7|Δ7?/g, 'maj7')
  s = s.replace(/5-|-5/g, 'b5')
  s = s.replace(/5\+|\+5|aug|^\+$/g, 'aug')
  s = s.replace(/^min/, 'm').replace(/^-(?!\d)/, 'm')
  // "7(9)" / "7/9" = 9, "m7(9)" = m9, "7M(9)" = maj9
  s = s.replace(/^(7|maj7|m7)\/?9$/, (_, a: string) => a.replace('7', '') + '9')
  return s
}

interface Parsed {
  root: string
  quality: Quality
  approximate: boolean
}

function parseQuality(main: string): Parsed | null {
  const p = parseChord(main)
  if (!p) return null
  const s = normalizeSuffix(p.suffix)

  const exact = (q: Quality): Parsed => ({ root: p.root, quality: q, approximate: false })
  const approx = (q: Quality): Parsed => ({ root: p.root, quality: q, approximate: true })

  if (s === '') return exact('major')
  if (s === 'm') return exact('minor')
  if (s === '7') return exact('7')
  if (s === 'm7') return exact('m7')
  if (s === 'maj7') return exact('maj7')
  if (s === 'sus4' || s === '4' || s === 'sus') return exact('sus4')
  if (s === 'sus2' || s === '2') return exact('sus2')
  if (s === '7sus4' || s === '74' || s === '7sus') return exact('7sus4')
  if (s === '9') return exact('9')
  if (s === '5') return exact('5')
  if (s === 'aug') return exact('aug')
  if (/^dim7?$/.test(s)) return exact('dim')
  if (/^(m7b5|mb5|m7\(b5\))$/.test(s)) return exact('m7b5')

  // Close relatives: show the nearest playable shape, flagged ≈.
  if (/^maj/.test(s)) return approx('maj7')
  if (/^m7b5|^mb5/.test(s)) return approx('m7b5')
  if (/^dim/.test(s)) return approx('dim')
  if (/^m(7|9|11|13)/.test(s)) return approx('m7')
  if (/^m/.test(s)) return approx('minor')
  if (/^7sus/.test(s)) return approx('7sus4')
  if (/^sus4|^4/.test(s)) return approx('sus4')
  if (/^sus2|^2/.test(s)) return approx('sus2')
  if (/^(7|9|11|13)/.test(s)) return approx('7')
  if (/^aug/.test(s)) return approx('aug')
  return approx('major')
}

function finish(frets: number[], approximate?: boolean): ChordShape {
  const played = frets.filter((f) => f > 0)
  const min = played.length ? Math.min(...played) : 0
  const max = played.length ? Math.max(...played) : 0
  const baseFret = max <= 4 ? 1 : min

  // A barre: the lowest fret is held on 2+ strings and nothing is open.
  let barre: ChordShape['barre']
  if (min > 0 && !frets.includes(0)) {
    const at = frets.map((f, i) => (f === min ? i : -1)).filter((i) => i >= 0)
    if (at.length >= 2) barre = { fret: min, from: at[0], to: at[at.length - 1] }
  }
  return { frets, baseFret, barre, approximate: approximate || undefined }
}

function movableShapes(rootIdx: number, quality: Quality): number[][] {
  const forms = MOVABLE[quality]
  const out: number[][] = []
  const tryForm = (offsets: Offsets | undefined, stringRoot: number) => {
    if (!offsets) return
    // Root fret on that string; try the low and the octave-up position.
    const base = (((rootIdx - stringRoot) % 12) + 12) % 12
    for (const r of [base, base + 12]) {
      const frets = offsets.map((o) => (o === null ? -1 : r + o))
      const played = frets.filter((f) => f >= 0)
      if (played.some((f) => f < 0) || frets.some((f, i) => offsets[i] !== null && f < 0)) continue
      if (Math.max(...played) > 15) continue
      // An all-open "barre" at fret 0 is just the open shape; keep it.
      out.push(frets)
      break
    }
  }
  tryForm(forms.e, 4) // E string
  tryForm(forms.a, 9) // A string
  return out
}

/**
 * All voicings we can show for a chord, best first: the curated open
 * shape (if any), then movable shapes from lowest to highest position.
 */
export function getChordShapes(name: string): ChordShape[] {
  const clean = name.trim()
  if (!clean) return []
  const shapes: ChordShape[] = []
  const seen = new Set<string>()
  const add = (s: ChordShape) => {
    const k = s.frets.join(',')
    if (seen.has(k)) return
    seen.add(k)
    shapes.push(s)
  }

  if (OPEN[clean]) add(finish(OPEN[clean]))

  const [main, bass] = clean.split('/')
  const parsed = parseQuality(main)
  if (!parsed) return shapes
  const ri = noteIndex(parsed.root)
  if (ri < 0) return shapes

  // Slash chord without a dedicated shape: show the main chord, flagged ≈.
  const slashApprox = !!bass && !OPEN[clean]
  const approx = parsed.approximate || slashApprox

  // Open shape for the normalized chord (e.g. "C7M" -> "Cmaj7", "Db" -> "C#").
  const names: Record<Quality, string> = {
    major: '', minor: 'm', '7': '7', m7: 'm7', maj7: 'maj7', sus4: 'sus4',
    sus2: 'sus2', '7sus4': '7sus4', '9': '9', dim: 'dim', m7b5: 'm7b5',
    aug: 'aug', '5': '5',
  }
  for (const root of enharmonics(parsed.root)) {
    const alias = root + names[parsed.quality]
    if (OPEN[alias]) add(finish(OPEN[alias], approx))
  }

  const movable = movableShapes(ri, parsed.quality)
    .map((f) => finish(f, approx))
    .sort((a, b) => position(a) - position(b))
  movable.forEach(add)
  return shapes
}

function enharmonics(root: string): string[] {
  const i = noteIndex(root)
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
  return [...new Set([root, names[i], flats[i]])]
}

function position(s: ChordShape): number {
  const played = s.frets.filter((f) => f > 0)
  return played.length ? Math.min(...played) : 0
}

export function getChordShape(name: string): ChordShape | null {
  return getChordShapes(name)[0] ?? null
}

/**
 * Rough playing difficulty of a chord's easiest shape: open chords are
 * easy, barres and high positions are hard. Used to suggest a capo.
 */
export function chordDifficulty(name: string): number {
  const s = getChordShape(name)
  if (!s) return 3
  let d = 1
  if (s.barre) d += s.barre.to - s.barre.from >= 4 ? 2 : 1.5
  if (s.baseFret > 4) d += 0.5
  if (s.approximate) d += 0.3
  return d
}
