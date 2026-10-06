import type { Line, Token } from '../sources/types'

/**
 * Chord grammar, notation conversion and transposition.
 *
 * Chords are stored internally in English notation (C D E F G A B). Sources
 * that use Latin notation (Do Re Mi Fa Sol La Si — common on Spanish sites)
 * are normalized when parsed, and the UI can render either notation.
 */

export const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const NOTE_INDEX: Record<string, number> = {
  C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4,
  'E#': 5, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10,
  Bb: 10, B: 11, Cb: 11,
}

export function noteIndex(note: string): number {
  return NOTE_INDEX[note] ?? -1
}

const ROOT = '[A-G](?:#|b)?'
// Suffix vocabulary: qualities, extensions, alterations and parenthesized
// extensions like "(9,13)". Deliberately excludes free letters so words
// like "Amor" or "De" fail.
const PAREN = '\\((?:add|sus|maj|no|M|m|º|°|\\+|-|\\d|#|b|,)*\\)'
const SUFFIX = `(?:maj|min|dim|aug|sus|add|alt|no|M|m|º|°|ø|\\+|-|\\d|#|b|${PAREN}|/(?=\\d)|Δ)*`
const CHORD_RE = new RegExp(`^(${ROOT})(${SUFFIX})(?:/(${ROOT}))?$`)

const LATIN_ROOTS: Record<string, string> = {
  do: 'C', re: 'D', mi: 'E', fa: 'F', sol: 'G', la: 'A', si: 'B',
}
const LATIN_RE = new RegExp(
  `^(do|re|mi|fa|sol|la|si)(#|b)?(${SUFFIX})(?:/((?:do|re|mi|fa|sol|la|si)(?:#|b)?|${ROOT}))?$`,
  'i'
)

export interface ParsedChord {
  root: string
  suffix: string
  bass?: string
}

export function parseChord(name: string): ParsedChord | null {
  const m = name.match(CHORD_RE)
  if (!m) return null
  return { root: m[1], suffix: m[2], bass: m[3] }
}

/** Does this token look like a chord (English notation)? */
export function looksLikeChord(text: string): boolean {
  const t = text.trim()
  return t.length > 0 && CHORD_RE.test(t)
}

function latinNote(n: string): string {
  const m = n.match(/^(do|re|mi|fa|sol|la|si)(#|b)?$/i)
  if (!m) return n
  return LATIN_ROOTS[m[1].toLowerCase()] + (m[2] ?? '')
}

/**
 * Canonical English spelling for a chord written by a source:
 * unicode accidentals → #/b, Latin roots → letters ("Sim" → "Bm",
 * "Fa#m7" → "F#m7", "Re/Fa#" → "D/F#"). Returns null if it isn't a chord.
 */
export function normalizeChord(raw: string): string | null {
  let s = raw.trim().replace(/♯/g, '#').replace(/♭/g, 'b')
  if (!s) return null
  if (CHORD_RE.test(s)) return s
  // Latin names must start with a capital ("Sol", "SOL"), never "sol".
  if (/^[DRMFLS]/.test(s)) {
    const m = s.match(LATIN_RE)
    if (m) {
      const root = LATIN_ROOTS[m[1].toLowerCase()] + (m[2] ?? '')
      // "LAm" / "SIm7": all-caps root with lowercase suffix is fine; an
      // uppercase "M" right after an all-caps root means minor there.
      let suffix = m[3]
      if (m[1] === m[1].toUpperCase() && m[1].length > 1 && /^M(?!aj)/.test(suffix)) {
        suffix = 'm' + suffix.slice(1)
      }
      const bass = m[4] ? latinNote(m[4]) : undefined
      s = root + suffix + (bass ? '/' + bass : '')
      return CHORD_RE.test(s) ? s : null
    }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Transposition                                                       */
/* ------------------------------------------------------------------ */

const FLAT_KEYS = new Set([
  'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
  'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm',
])

/** Whether a key is conventionally written with flats. */
export function keyUsesFlats(key: string | undefined | null): boolean {
  if (!key) return false
  const k = parseKey(key)
  return k ? FLAT_KEYS.has(k.root + (k.minor ? 'm' : '')) : false
}

function shiftNote(note: string, steps: number, flats: boolean): string {
  const i = noteIndex(note)
  if (i < 0) return note
  return (flats ? FLAT : SHARP)[(((i + steps) % 12) + 12) % 12]
}

/**
 * Transpose a chord by `steps` semitones. `flats` picks the accidental
 * spelling (derive it from the target key with keyUsesFlats); when omitted
 * the chord's own spelling decides.
 */
export function transposeChord(chord: string, steps: number, flats?: boolean): string {
  if (steps % 12 === 0 && flats === undefined) return chord
  const p = parseChord(chord)
  if (!p) return chord
  const useFlats = flats ?? /^[A-G]b/.test(chord)
  let out = shiftNote(p.root, steps, useFlats) + p.suffix
  if (p.bass) out += '/' + shiftNote(p.bass, steps, useFlats)
  return out
}

export function transposeLines(lines: Line[], steps: number, flats?: boolean): Line[] {
  if (steps % 12 === 0 && flats === undefined) return lines
  return lines.map((line) => ({
    tokens: line.tokens.map((t) =>
      t.chord ? { ...t, text: transposeChord(t.text, steps, flats) } : t
    ),
  }))
}

/* ------------------------------------------------------------------ */
/* Keys                                                                */
/* ------------------------------------------------------------------ */

export interface KeyInfo {
  root: string
  minor: boolean
}

export function parseKey(key: string): KeyInfo | null {
  const norm = normalizeChord(key.replace(/\s+/g, '')) ?? key
  const p = parseChord(norm)
  if (!p) return null
  return { root: p.root, minor: /^(m(?!aj)|min|-)/.test(p.suffix) }
}

export function formatKey(k: KeyInfo): string {
  return k.root + (k.minor ? 'm' : '')
}

/** Transpose a key name, spelled the way that key is usually written. */
export function transposeKey(key: string, steps: number): string {
  const k = parseKey(key)
  if (!k) return key
  const idx = (((noteIndex(k.root) + steps) % 12) + 12) % 12
  return k.minor ? MINOR_KEY_NAMES[idx] : MAJOR_KEY_NAMES[idx]
}

// Conventional key spellings (e.g. Bb not A#, F# not Gb, G#m not Abm).
const MAJOR_KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const MINOR_KEY_NAMES = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm']

type Quality = 'maj' | 'min' | 'dim'

function chordQuality(suffix: string): Quality {
  if (/^(dim|º|°|ø|m7b5|m7\(b5\)|m7\(5-\)|mb5)/.test(suffix)) return 'dim'
  if (/^(m(?!aj)|min|-)/.test(suffix)) return 'min'
  return 'maj'
}

const MAJOR_DEGREES: Array<[number, Quality]> = [
  [0, 'maj'], [2, 'min'], [4, 'min'], [5, 'maj'], [7, 'maj'], [9, 'min'], [11, 'dim'],
]
const MINOR_DEGREES: Array<[number, Quality]> = [
  [0, 'min'], [2, 'dim'], [3, 'maj'], [5, 'min'], [7, 'min'], [7, 'maj'], [8, 'maj'], [10, 'maj'],
]

/**
 * Guess the key from the chords of a song (in order, with repeats).
 * Scores every major/minor key by how well the chords fit its diatonic
 * harmony, favouring the first and last chord as the tonic.
 */
export function detectKey(chords: string[]): string | null {
  const parsed = chords
    .map((c) => parseChord(c))
    .filter((p): p is ParsedChord => !!p && noteIndex(p.root) >= 0)
  if (parsed.length === 0) return null

  let best: { key: KeyInfo; score: number } | null = null
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const minor of [false, true]) {
      const degrees = minor ? MINOR_DEGREES : MAJOR_DEGREES
      const tonicQ: Quality = minor ? 'min' : 'maj'
      let score = 0
      parsed.forEach((p, idx) => {
        const interval = (noteIndex(p.root) - tonic + 12) % 12
        const q = chordQuality(p.suffix)
        const fits = degrees.filter(([d]) => d === interval)
        if (fits.some(([, dq]) => dq === q)) score += 1
        else if (fits.length) score += 0.3
        else score -= 0.6
        if (interval === 0 && q === tonicQ) {
          score += 0.5
          if (idx === 0) score += 2
          if (idx === parsed.length - 1) score += 1.5
        }
      })
      if (!best || score > best.score) {
        best = { key: { root: SHARP[tonic], minor }, score }
      }
    }
  }
  if (!best) return null
  // Spell it conventionally.
  return transposeKey(formatKey(best.key), 0)
}

/* ------------------------------------------------------------------ */
/* Notation (display)                                                  */
/* ------------------------------------------------------------------ */

export type Notation = 'english' | 'latin'

const TO_LATIN: Record<string, string> = {
  C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si',
}

function noteToLatin(note: string): string {
  return (TO_LATIN[note[0]] ?? note[0]) + note.slice(1)
}

/** Render a chord in the user's preferred notation. */
export function displayChord(chord: string, notation: Notation): string {
  if (notation === 'english') return chord
  const p = parseChord(chord)
  if (!p) return chord
  return noteToLatin(p.root) + p.suffix + (p.bass ? '/' + noteToLatin(p.bass) : '')
}

/* ------------------------------------------------------------------ */
/* Tokenizers                                                          */
/* ------------------------------------------------------------------ */

/**
 * Shared tokenizer. Takes text where chords are delimited by the sentinels
 * \x02 (start) and \x03 (end), and produces structured Lines. Whitespace is
 * preserved so monospace rendering keeps chord/lyric alignment. Marked
 * tokens are normalized (Latin → English); anything that isn't really a
 * chord stays as plain text.
 */
export const CH_START = '\x02'
export const CH_END = '\x03'

export function tokenizeMarked(raw: string): Line[] {
  const lines: Line[] = []
  for (const rawLine of raw.replace(/\r\n?/g, '\n').split('\n')) {
    const tokens: Token[] = []
    const push = (text: string, chord: boolean) => {
      if (!text) return
      const last = tokens[tokens.length - 1]
      if (!chord && last && !last.chord) last.text += text
      else tokens.push({ text, chord })
    }
    let i = 0
    while (i < rawLine.length) {
      const start = rawLine.indexOf(CH_START, i)
      if (start === -1) {
        push(rawLine.slice(i), false)
        break
      }
      if (start > i) push(rawLine.slice(i, start), false)
      const end = rawLine.indexOf(CH_END, start)
      if (end === -1) {
        push(rawLine.slice(start + 1), false)
        break
      }
      const inner = rawLine.slice(start + 1, end)
      const lead = inner.match(/^\s*/)![0]
      const trail = inner.match(/\s*$/)![0]
      const name = normalizeChord(inner)
      if (name) {
        push(lead, false)
        // Keep the column width of the original text so alignment holds
        // even when normalization changes length ("Sim" → "Bm").
        tokens.push({ text: name, chord: true })
        const diff = inner.trim().length - name.length
        push(diff > 0 ? ' '.repeat(diff) + trail : trail, false)
      } else {
        push(inner, false)
      }
      i = end + 1
    }
    lines.push({ tokens: tokens.map((t) => (t.chord ? t : { ...t, text: t.text.replace(/[\x02\x03]/g, '') })) })
  }
  return trimEmpty(lines)
}

function trimEmpty(lines: Line[]): Line[] {
  const isEmpty = (l: Line) => l.tokens.every((t) => !t.chord && !t.text.trim())
  while (lines.length && isEmpty(lines[0])) lines.shift()
  while (lines.length && isEmpty(lines[lines.length - 1])) lines.pop()
  // Collapse runs of 3+ blank lines into 2.
  const out: Line[] = []
  let blanks = 0
  for (const l of lines) {
    if (isEmpty(l)) {
      blanks++
      if (blanks > 2) continue
      out.push({ tokens: [] })
    } else {
      blanks = 0
      out.push(l)
    }
  }
  return out
}

/** Bar-line / repeat decorations allowed on a chord line. */
const DECORATION = /^(\||\|\||-+|\/|%|\(|\)|x\d+|\d+x|\(x\d+\)|\.+|:|\[|\])$/i

/**
 * Parse plain monospace text (no chord markup) by detecting "chord lines":
 * lines where most words look like chords get those words marked. Latin
 * names count only on lines that are clearly all chords, because "La",
 * "Mi" or "Si" are also common Spanish words.
 */
export function tokenizePlainText(raw: string): Line[] {
  const lines: Line[] = []
  for (const rawLine of raw.replace(/\r\n?/g, '\n').split('\n')) {
    const words = rawLine.split(/\s+/).filter(Boolean)
    const english = words.filter(looksLikeChord).length
    const latin = words.filter((w) => !looksLikeChord(w) && normalizeChord(w)).length
    const deco = words.filter((w) => DECORATION.test(w)).length
    const content = words.length - deco
    const isChordLine =
      content > 0 &&
      (english / content >= 0.6 ||
        ((english + latin) / content >= 1 && (content >= 2 || latin === 0)))

    if (!isChordLine) {
      lines.push({ tokens: rawLine ? [{ text: rawLine, chord: false }] : [] })
      continue
    }
    const tokens: Token[] = []
    const re = /(\s+)|(\S+)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(rawLine))) {
      if (m[1]) {
        tokens.push({ text: m[1], chord: false })
        continue
      }
      const name = normalizeChord(m[2])
      if (name) {
        tokens.push({ text: name, chord: true })
        const diff = m[2].length - name.length
        if (diff > 0) tokens.push({ text: ' '.repeat(diff), chord: false })
      } else tokens.push({ text: m[2], chord: false })
    }
    lines.push({ tokens })
  }
  return trimEmpty(lines)
}

/** Collect the distinct chords used in a sheet, in order of appearance. */
export function uniqueChords(lines: Line[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    for (const t of line.tokens) {
      if (t.chord && !seen.has(t.text)) {
        seen.add(t.text)
        out.push(t.text)
      }
    }
  }
  return out
}

/** All chord occurrences in order (with repeats) — input for detectKey. */
export function chordSequence(lines: Line[]): string[] {
  const out: string[] = []
  for (const line of lines) for (const t of line.tokens) if (t.chord) out.push(t.text)
  return out
}

/* ------------------------------------------------------------------ */
/* Compact serialization (for localStorage)                            */
/* ------------------------------------------------------------------ */

/** Lines → one marked string (much smaller than token JSON). */
export function serializeLines(lines: Line[]): string {
  return lines
    .map((l) => l.tokens.map((t) => (t.chord ? CH_START + t.text + CH_END : t.text)).join(''))
    .join('\n')
}

export function deserializeLines(sheet: string): Line[] {
  return tokenizeMarked(sheet)
}
