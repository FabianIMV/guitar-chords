import { describe, expect, it } from 'vitest'
import { chordDifficulty, getChordShape, getChordShapes } from '../src/lib/chordShapes'
import {
  deserializeLines,
  detectKey,
  displayChord,
  keyUsesFlats,
  looksLikeChord,
  normalizeChord,
  serializeLines,
  tokenizeMarked,
  tokenizePlainText,
  transposeChord,
  transposeKey,
  CH_END as E,
  CH_START as S,
} from '../src/lib/chords'
import { resolveWrittenKey, suggestCapo } from '../src/lib/music'

describe('chord grammar', () => {
  it.each([
    'C', 'Am', 'C7M', 'Bº', 'Am7(5-)', 'D4', 'A2', 'E5+', 'D/F#', 'F#m7b5',
    'Bb7(9)', 'A7(13)', 'E7/9', 'Dm6', 'Cmaj7', 'Asus2', 'G6', 'C#m7', 'Ebm',
    'Fadd9', 'C(add9)', 'G7+', 'A-', 'B°', 'C9/E',
  ])('accepts %s', (c) => expect(looksLikeChord(c)).toBe(true))

  it.each(['Amor', 'De', 'la', 'Fue', 'Ana', 'Dad', 'Bed', 'Do', 'Cada', 'Gato', 'E,'])(
    'rejects %s',
    (w) => expect(looksLikeChord(w)).toBe(false)
  )
})

describe('Latin notation', () => {
  it.each([
    ['Sim', 'Bm'], ['Sol', 'G'], ['LA', 'A'], ['Lam', 'Am'], ['Re/Fa#', 'D/F#'],
    ['Fa#m7', 'F#m7'], ['Sib', 'Bb'], ['Mib7', 'Eb7'], ['Do7M', 'C7M'],
    ['SOL7', 'G7'], ['LAM', 'Am'], ['Rem', 'Dm'], ['Si7', 'B7'], ['C♯m', 'C#m'],
  ])('%s → %s', (input, out) => expect(normalizeChord(input)).toBe(out))

  it('rejects lowercase words', () => {
    expect(normalizeChord('la')).toBeNull()
    expect(normalizeChord('sol')).toBeNull()
    expect(normalizeChord('Solo')).toBeNull()
    expect(normalizeChord('Mira')).toBeNull()
  })

  it('renders English chords in Latin', () => {
    expect(displayChord('Bm', 'latin')).toBe('Sim')
    expect(displayChord('F#m7/C#', 'latin')).toBe('Fa#m7/Do#')
    expect(displayChord('G', 'english')).toBe('G')
  })
})

describe('transposition', () => {
  it('keeps suffixes and bass', () => {
    expect(transposeChord('G/B', 2)).toBe('A/C#')
    expect(transposeChord('C7M', 2)).toBe('D7M')
    expect(transposeChord('Am7(5-)', 3)).toBe('Cm7(5-)')
  })
  it('spells by target key when told', () => {
    expect(transposeChord('C', 1, true)).toBe('Db')
    expect(transposeChord('C', 1, false)).toBe('C#')
    expect(transposeChord('E', 6, true)).toBe('Bb')
  })
  it('defaults to the chord own spelling', () => {
    expect(transposeChord('Bb', 2)).toBe('C')
    expect(transposeChord('Bb', 1)).toBe('B')
    expect(transposeChord('Eb', -1)).toBe('D')
    expect(transposeChord('Ab', 1)).toBe('A')
  })
  it('transposes keys conventionally', () => {
    expect(transposeKey('G', 3)).toBe('Bb')
    expect(transposeKey('Bm', 2)).toBe('C#m')
    expect(transposeKey('D', 4)).toBe('F#')
    expect(transposeKey('Am', -2)).toBe('Gm')
    expect(keyUsesFlats('F')).toBe(true)
    expect(keyUsesFlats('Gm')).toBe(true)
    expect(keyUsesFlats('E')).toBe(false)
  })
})

describe('key detection', () => {
  it('finds common keys', () => {
    expect(detectKey(['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'G'])).toBe('G')
    expect(detectKey(['Bm', 'G', 'D', 'A', 'Bm', 'G', 'D', 'A', 'Bm'])).toBe('Bm')
    expect(detectKey(['Am', 'F', 'C', 'G', 'Am', 'E7', 'Am'])).toBe('Am')
    expect(detectKey(['F', 'Bb', 'C7', 'F', 'Dm', 'Gm', 'C', 'F'])).toBe('F')
  })
  it('returns null without chords', () => expect(detectKey([])).toBeNull())
})

describe('chord shapes', () => {
  it('uses curated open shapes', () => {
    expect(getChordShape('C')?.frets).toEqual([-1, 3, 2, 0, 1, 0])
    expect(getChordShape('Bm')?.frets).toEqual([-1, 2, 4, 4, 3, 2])
    expect(getChordShape('D/F#')?.frets).toEqual([2, -1, 0, 2, 3, 2])
    expect(getChordShape('Am/G')?.frets).toEqual([3, 0, 2, 2, 1, 0])
  })
  it('understands Brazilian spellings', () => {
    expect(getChordShape('C7M')?.frets).toEqual(getChordShape('Cmaj7')?.frets)
    expect(getChordShape('G7+')?.frets).toEqual(getChordShape('Gmaj7')?.frets)
    expect(getChordShape('D4')?.frets).toEqual([-1, -1, 0, 2, 3, 3])
    expect(getChordShape('A2')?.frets).toEqual([-1, 0, 2, 2, 0, 0])
    expect(getChordShape('Bº')?.frets).toEqual([-1, 2, 3, 1, 3, -1])
    expect(getChordShape('Bm7(5-)')?.frets).toEqual([-1, 2, 3, 2, 3, -1])
    expect(getChordShape('Am7(5-)')?.frets).toEqual([-1, 0, 1, 0, 1, -1])
  })
  it('builds movable barres', () => {
    expect(getChordShape('G#m7')?.frets).toEqual([4, 6, 4, 4, 4, 4])
    expect(getChordShape('Bsus4')?.frets).toEqual([-1, 2, 4, 4, 5, 2])
    expect(getChordShape('Db')?.frets).toEqual([-1, 4, 6, 6, 6, 4])
  })
  it('detects barres for drawing', () => {
    expect(getChordShape('F')?.barre).toEqual({ fret: 1, from: 0, to: 5 })
    expect(getChordShape('Bm')?.barre).toEqual({ fret: 2, from: 1, to: 5 })
    expect(getChordShape('D')?.barre).toBeUndefined()
    expect(getChordShape('Bm')?.baseFret).toBe(1)
    expect(getChordShape('C#m')?.baseFret).toBe(4)
  })
  it('offers alternative voicings', () => {
    const shapes = getChordShapes('A')
    expect(shapes.length).toBeGreaterThanOrEqual(2)
    expect(shapes[0].frets).toEqual([-1, 0, 2, 2, 2, 0])
    expect(shapes.some((s) => s.frets.join() === '5,7,7,6,5,5')).toBe(true)
  })
  it('flags approximations', () => {
    expect(getChordShape('C13')?.approximate).toBe(true)
    expect(getChordShape('Am/B')?.approximate).toBe(true)
    expect(getChordShape('C')?.approximate).toBeUndefined()
  })
  it('rates difficulty', () => {
    expect(chordDifficulty('G')).toBeLessThan(chordDifficulty('F'))
    expect(chordDifficulty('Em')).toBeLessThan(chordDifficulty('Bbm'))
  })
})

describe('capo suggestion', () => {
  it('suggests capo for flat keys', () => {
    // Bb F Gm Eb: with capo 3 these are G D Em C.
    const s = suggestCapo(['Bb', 'F', 'Gm', 'Eb'], 0, 0, 'Bb')
    expect(s?.capo).toBe(3)
    expect(s?.shapesKey).toBe('G')
  })
  it('does not suggest when already easy', () => {
    expect(suggestCapo(['G', 'D', 'Em', 'C'], 0, 0, 'G')).toBeNull()
  })
})

describe('tokenizers', () => {
  it('parses marked chords and normalizes Latin names keeping columns', () => {
    const lines = tokenizeMarked(`${S}Sim${E}   ${S}Sol${E}\nElla durmió`)
    expect(lines[0].tokens.filter((t) => t.chord).map((t) => t.text)).toEqual(['Bm', 'G'])
    // "Sim" → "Bm" keeps the next chord at column 6.
    const text = lines[0].tokens.map((t) => t.text).join('')
    expect(text.indexOf('G')).toBe(6)
  })
  it('turns non-chords inside markup back into text', () => {
    const lines = tokenizeMarked(`${S}Intro${E} ${S}Am${E}`)
    expect(lines[0].tokens).toEqual([
      { text: 'Intro ', chord: false },
      { text: 'Am', chord: true },
    ])
  })
  it('detects chord lines in plain text', () => {
    const lines = tokenizePlainText('Am    F    C   G\nLa casa de mi amor\nDo  Sol  Lam  Fa\nSi te vas')
    expect(lines[0].tokens.filter((t) => t.chord).length).toBe(4)
    expect(lines[1].tokens.some((t) => t.chord)).toBe(false)
    expect(lines[2].tokens.filter((t) => t.chord).map((t) => t.text)).toEqual(['C', 'G', 'Am', 'F'])
    expect(lines[3].tokens.some((t) => t.chord)).toBe(false)
  })
  it('accepts bar decorations on chord lines', () => {
    const lines = tokenizePlainText('| Am  | F  | C  G | (x2)')
    expect(lines[0].tokens.filter((t) => t.chord).length).toBe(4)
  })
  it('round-trips compact serialization', () => {
    const lines = tokenizeMarked(`  ${S}C${E}   ${S}G/B${E}\nhola mundo\n\n[Coro]`)
    expect(deserializeLines(serializeLines(lines))).toEqual(lines)
  })
})

describe('resolveWrittenKey', () => {
  it('maps a sounding key back to the capo shapes (UG style)', () => {
    // Hotel California on UG: key Bm, capo 2, chords written in Am.
    expect(resolveWrittenKey(['Am', 'E7', 'G', 'D', 'F', 'C', 'Dm', 'E7'], 'Bm', 2)).toBe('Am')
  })
  it('keeps a key that already describes the shapes', () => {
    expect(resolveWrittenKey(['G', 'D', 'Em', 'C'], 'G', 3)).toBe('G')
  })
  it('trusts the source between relative major/minor', () => {
    expect(resolveWrittenKey(['Bm', 'G', 'D', 'A', 'D'], 'Bm', 0)).toBe('Bm')
    expect(resolveWrittenKey(['Bm', 'G', 'D', 'A', 'Bm'], 'D', 0)).toBe('D')
  })
  it('falls back to detection', () => {
    expect(resolveWrittenKey(['C', 'F', 'G', 'C'], undefined, 0)).toBe('C')
  })
})
