import type { Line, Token } from '../sources/types'

/**
 * Turns parsed lines into blocks the sheet can render responsively.
 *
 * Chord sheets are written for a monospace page: a chord line sits above a
 * lyric line and columns line them up. On a phone those lines don't fit, so
 * in "wrap" mode we pair each chord line with its lyric line and anchor
 * every chord to the character it sits over; the lyric can then wrap like
 * normal text and chords travel with their syllables.
 */

export interface Placed {
  col: number
  chord: string
}

export type Block =
  | { type: 'section'; label: string }
  | { type: 'pair'; chords: Placed[]; lyric: string }
  | { type: 'chords'; tokens: Token[] }
  | { type: 'text'; text: string }
  | { type: 'tab'; lines: string[] }
  | { type: 'blank' }

const lineText = (l: Line) => l.tokens.map((t) => t.text).join('')
const hasChord = (l: Line) => l.tokens.some((t) => t.chord)
const isBlank = (l: Line) => !hasChord(l) && !lineText(l).trim()

/** Bar lines, repeats and brackets that may sit on a chord line. */
const DECOR = /^[\s|/\\\-–—().,:;%*x\d[\]{}>]*$/i

function isChordLine(l: Line): boolean {
  return hasChord(l) && l.tokens.every((t) => t.chord || DECOR.test(t.text))
}

/** Tablature staff line: "e|--3--|", "B|-1-1-", "|--0--2--|". */
export function isTabLine(text: string): boolean {
  const t = text.trim()
  if (t.length < 6) return false
  const dashes = (t.match(/-/g) ?? []).length
  if (dashes < 4) return false
  return /^([A-Ga-g][#b]?\s?)?[|:]?[-–\d|hpbr/\\~x*().^\s]+$/.test(t) && dashes / t.length > 0.35
}

const SECTION_NAMES =
  'intro|introducci[oó]n|coro|estribillo|verso|estrofa|puente|solo|final|outro|pre-?coro|' +
  'refr[aã]o|pr[eé]-?refr[aã]o|ponte|chorus|pre-?chorus|verse|bridge|interludio|interl[uú]dio|interlude|' +
  'instrumental|riff|primera parte|segunda parte|tercera parte|primeira parte|terceira parte|' +
  'parte \\d|base|dedilhado|punteo|arpegio|coda|fin'
const SECTION_PLAIN = new RegExp(`^(${SECTION_NAMES})(\\s*\\d+)?\\s*[:.…]*\\s*(\\(.{0,20}\\))?\\s*$`, 'i')
const SECTION_BRACKET = /^\[([^\]]{1,40})\]$/

const SECTION_ES: Array<[RegExp, string]> = [
  [/^pr[eé]-?refr[aã]o/i, 'Pre-coro'],
  [/^pre-?chorus/i, 'Pre-coro'],
  [/^refr[aã]o final/i, 'Coro final'],
  [/^refr[aã]o|^chorus/i, 'Coro'],
  [/^primeira parte/i, 'Primera parte'],
  [/^segunda parte/i, 'Segunda parte'],
  [/^terceira parte/i, 'Tercera parte'],
  [/^ponte|^bridge/i, 'Puente'],
  [/^verse/i, 'Verso'],
  [/^interl[uú]dio|^interlude/i, 'Interludio'],
  [/^outro/i, 'Final'],
  [/^dedilhado/i, 'Arpegio'],
]

/** Section label in Spanish ("[Refrão]" → "Coro", "Verse 2" → "Verso 2"). */
export function sectionLabel(raw: string): string {
  let s = raw.replace(/[:.…]+$/, '').trim()
  for (const [re, es] of SECTION_ES) {
    if (re.test(s)) {
      s = s.replace(re, es)
      break
    }
  }
  s = s.toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function sectionOf(l: Line): string | null {
  if (hasChord(l)) return null
  const t = lineText(l).trim()
  const b = t.match(SECTION_BRACKET)
  if (b) return sectionLabel(b[1])
  if (SECTION_PLAIN.test(t)) return sectionLabel(t.replace(/\(.*\)/, '').trim())
  return null
}

/** Chords of a chord line with their column positions. */
export function placeChords(l: Line): Placed[] {
  const out: Placed[] = []
  let col = 0
  for (const t of l.tokens) {
    if (t.chord) out.push({ col, chord: t.text })
    col += t.text.length
  }
  return out
}

/** Split "[Intro] Am G" into a section label + chord tokens. */
function leadingLabel(l: Line): { label: string; rest: Token[] } | null {
  const first = l.tokens[0]
  if (!first || first.chord) return null
  const m = first.text.match(/^\s*(\[([^\]]{1,30})\]|([A-Za-zÀ-ÿ -]{3,20}):)\s*/)
  if (!m) return null
  const label = m[2] ?? m[3]
  const remainder = first.text.slice(m[0].length)
  const rest = [...(remainder ? [{ text: remainder, chord: false }] : []), ...l.tokens.slice(1)]
  if (!rest.some((t) => t.chord)) return null
  return { label: sectionLabel(label), rest }
}

export function layoutLines(lines: Line[]): Block[] {
  const blocks: Block[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const text = lineText(line)

    if (isBlank(line)) {
      if (blocks.length && blocks[blocks.length - 1].type !== 'blank') blocks.push({ type: 'blank' })
      continue
    }

    if (!hasChord(line) && isTabLine(text)) {
      const prev = blocks[blocks.length - 1]
      if (prev?.type === 'tab') prev.lines.push(text)
      else blocks.push({ type: 'tab', lines: [text] })
      continue
    }

    const section = sectionOf(line)
    if (section) {
      blocks.push({ type: 'section', label: section })
      continue
    }

    const labelled = leadingLabel(line)
    if (labelled && labelled.rest.every((t) => t.chord || DECOR.test(t.text))) {
      blocks.push({ type: 'section', label: labelled.label })
      blocks.push({ type: 'chords', tokens: trimTokens(labelled.rest) })
      continue
    }

    if (isChordLine(line)) {
      const next = lines[i + 1]
      const nextText = next ? lineText(next) : ''
      if (next && !hasChord(next) && nextText.trim() && !sectionOf(next) && !isTabLine(nextText)) {
        blocks.push({ type: 'pair', chords: placeChords(line), lyric: nextText.replace(/\s+$/, '') })
        i++
      } else {
        blocks.push({ type: 'chords', tokens: trimTokens(line.tokens) })
      }
      continue
    }

    if (hasChord(line)) {
      // Mixed line ("Tabbed by…" with chords inside, inline chords): keep tokens.
      blocks.push({ type: 'chords', tokens: line.tokens })
      continue
    }

    blocks.push({ type: 'text', text: text.replace(/\s+$/, '') })
  }
  while (blocks.length && blocks[blocks.length - 1].type === 'blank') blocks.pop()
  return blocks
}

function trimTokens(tokens: Token[]): Token[] {
  const out = tokens.map((t) => ({ ...t }))
  while (out.length && !out[0].chord && !out[0].text.trim()) out.shift()
  if (out[0] && !out[0].chord) out[0].text = out[0].text.replace(/^\s+/, '')
  while (out.length && !out[out.length - 1].chord && !out[out.length - 1].text.trim()) out.pop()
  return out
}

/* ------------------------------------------------------------------ */
/* Word building for wrapped chord/lyric pairs                         */
/* ------------------------------------------------------------------ */

export interface Part {
  text: string
  chord?: string
}

/** A run that must not break across lines (a word, possibly with chords). */
export type Word = { parts: Part[] } | { space: string }

/**
 * Anchor chords to the lyric: words stay unbreakable, a chord in the middle
 * of a word splits it into parts, chords over spaces or past the end of the
 * lyric become their own (empty) words. Runs of spaces collapse to one:
 * they only existed to line chords up in a monospace layout.
 */
export function buildWords(chords: Placed[], lyric: string): Word[] {
  const at = new Map<number, string>()
  for (const c of chords) at.set(c.col, c.chord)
  const end = Math.max(lyric.length, ...chords.map((c) => c.col + 1))
  const words: Word[] = []
  let parts: Part[] = []
  let space = ''

  const flushWord = () => {
    if (parts.length) words.push({ parts })
    parts = []
  }
  const flushSpace = () => {
    if (space && words.length) words.push({ space: ' ' })
    space = ''
  }

  for (let i = 0; i < end; i++) {
    const ch = i < lyric.length ? lyric[i] : ' '
    const chord = at.get(i)
    if (ch === ' ' || ch === '\t') {
      flushWord()
      if (chord) {
        // Chord over a gap: its own anchor with a non-breaking space.
        flushSpace()
        words.push({ parts: [{ text: ' ', chord }] })
      } else space += ' '
      continue
    }
    flushSpace()
    if (chord || parts.length === 0) parts.push({ text: ch, chord })
    else parts[parts.length - 1].text += ch
  }
  flushWord()
  return words
}
