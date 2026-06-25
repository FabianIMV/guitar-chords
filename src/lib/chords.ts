import type { Line, Token } from '../sources/types'

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const NOTE_RE = /^([A-G][#b]?)(.*)$/

function shiftNote(note: string, steps: number, preferFlat: boolean): string {
  let i = SHARP.indexOf(note)
  if (i < 0) i = FLAT.indexOf(note)
  if (i < 0) return note
  const arr = preferFlat ? FLAT : SHARP
  return arr[(((i + steps) % 12) + 12) % 12]
}

/** Transpose a single chord token (e.g. "C#m7/G#") by `steps` semitones. */
export function transposeChord(token: string, steps: number): string {
  if (steps === 0) return token
  const preferFlat = /[A-G]b/.test(token)
  const [mainRaw, ...rest] = token.split('/')
  const bass = rest.length ? rest.join('/') : undefined

  const m = mainRaw.match(NOTE_RE)
  if (!m) return token
  let out = shiftNote(m[1], steps, preferFlat) + m[2]

  if (bass !== undefined) {
    const bm = bass.match(NOTE_RE)
    out += '/' + (bm ? shiftNote(bm[1], steps, preferFlat) + bm[2] : bass)
  }
  return out
}

export function transposeLines(lines: Line[], steps: number): Line[] {
  if (steps === 0) return lines
  return lines.map((line) => ({
    tokens: line.tokens.map((t) =>
      t.chord ? { ...t, text: transposeChord(t.text, steps) } : t
    ),
  }))
}

/**
 * Heuristic: does this token look like a real chord? Used when a source marks
 * something as a chord but we want to be safe, and for parsing plain text.
 */
const CHORD_RE =
  /^[A-G][#b]?(maj|min|m|sus|add|dim|aug|°|ø)?\d{0,2}(\([^)]*\))?(sus\d|add\d|maj\d|m\d|dim\d|aug)?(\/[A-G][#b]?)?$/

export function looksLikeChord(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return CHORD_RE.test(t)
}

/**
 * Shared tokenizer. Takes a raw text where chords are delimited by the
 * sentinels \x02 (start) and \x03 (end), and produces structured Lines.
 * Whitespace is preserved so monospace rendering keeps chord/lyric alignment.
 */
export const CH_START = '\x02'
export const CH_END = '\x03'

export function tokenizeMarked(raw: string): Line[] {
  const lines: Line[] = []
  for (const rawLine of raw.split('\n')) {
    const tokens: Token[] = []
    let i = 0
    while (i < rawLine.length) {
      const start = rawLine.indexOf(CH_START, i)
      if (start === -1) {
        if (i < rawLine.length) tokens.push({ text: rawLine.slice(i), chord: false })
        break
      }
      if (start > i) tokens.push({ text: rawLine.slice(i, start), chord: false })
      const end = rawLine.indexOf(CH_END, start)
      if (end === -1) {
        tokens.push({ text: rawLine.slice(start + 1), chord: false })
        break
      }
      const chord = rawLine.slice(start + 1, end).trim()
      if (chord) tokens.push({ text: chord, chord: true })
      i = end + 1
    }
    lines.push({ tokens })
  }
  // Trim trailing empty lines
  while (lines.length && lines[lines.length - 1].tokens.length === 0) lines.pop()
  return lines
}

/**
 * Parse plain monospace text (no chord markup) by detecting "chord lines":
 * lines where most whitespace-separated tokens look like chords get their
 * tokens marked as chords. Used as a fallback for sources without markup.
 */
export function tokenizePlainText(raw: string): Line[] {
  const lines: Line[] = []
  for (const rawLine of raw.split('\n')) {
    const words = rawLine.split(/\s+/).filter(Boolean)
    const chordWords = words.filter(looksLikeChord).length
    const isChordLine = words.length > 0 && chordWords / words.length >= 0.6

    if (!isChordLine) {
      lines.push({ tokens: rawLine ? [{ text: rawLine, chord: false }] : [] })
      continue
    }
    // Preserve spacing: walk the line, marking chord words.
    const tokens: Token[] = []
    const re = /(\s+)|(\S+)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(rawLine))) {
      if (m[1]) tokens.push({ text: m[1], chord: false })
      else tokens.push({ text: m[2], chord: looksLikeChord(m[2]) })
    }
    lines.push({ tokens })
  }
  while (lines.length && lines[lines.length - 1].tokens.length === 0) lines.pop()
  return lines
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
