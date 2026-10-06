import { describe, expect, it } from 'vitest'
import { buildWords, isTabLine, layoutLines, sectionLabel } from '../src/lib/layout'
import { tokenizeMarked, CH_END as E, CH_START as S } from '../src/lib/chords'

const sheet = (s: string) => tokenizeMarked(s.replace(/\[\[(.+?)\]\]/g, `${S}$1${E}`))

describe('layoutLines', () => {
  it('pairs chord lines with their lyric and finds sections', () => {
    const blocks = layoutLines(
      sheet(`[Refrão]\n\n[[Am]]       [[F]]\nUna línea de prueba\n[[C]]  [[G]]\n\nTexto suelto`)
    )
    expect(blocks.map((b) => b.type)).toEqual(['section', 'blank', 'pair', 'chords', 'blank', 'text'])
    expect(blocks[0]).toEqual({ type: 'section', label: 'Coro' })
    expect(blocks[2]).toEqual({
      type: 'pair',
      chords: [
        { col: 0, chord: 'Am' },
        { col: 9, chord: 'F' },
      ],
      lyric: 'Una línea de prueba',
    })
  })

  it('splits "[Intro] Am G" into a section and a chord row', () => {
    const blocks = layoutLines(sheet(`[Intro] [[Bm]]  [[G]]  [[D]]  [[A]]`))
    expect(blocks[0]).toEqual({ type: 'section', label: 'Intro' })
    expect(blocks[1].type).toBe('chords')
  })

  it('recognizes plain section headers', () => {
    const blocks = layoutLines(sheet(`CORO:\nIntro:\nSolo......\nVerse 2\nChorus`))
    expect(blocks.map((b) => (b.type === 'section' ? b.label : b.type))).toEqual([
      'Coro', 'Intro', 'Solo', 'Verso 2', 'Coro',
    ])
  })

  it('groups tablature lines', () => {
    const blocks = layoutLines(sheet(`e|-----0-----|\nB|---1---1---|\nG|-2-------2-|\nletra`))
    expect(blocks[0]).toEqual({
      type: 'tab',
      lines: ['e|-----0-----|', 'B|---1---1---|', 'G|-2-------2-|'],
    })
    expect(isTabLine('Una línea - con - guiones')).toBe(false)
  })

  it('does not pair a chord line with a section or tab', () => {
    const blocks = layoutLines(sheet(`[[Am]]  [[G]]\n[Coro]`))
    expect(blocks.map((b) => b.type)).toEqual(['chords', 'section'])
  })
})

describe('buildWords', () => {
  it('anchors chords to syllables without breaking words', () => {
    const words = buildWords(
      [
        { col: 0, chord: 'G' },
        { col: 7, chord: 'D' },
      ],
      'Ella durmió'
    )
    expect(words).toEqual([
      { parts: [{ text: 'Ella', chord: 'G' }] },
      { space: ' ' },
      { parts: [{ text: 'du' }, { text: 'rmió', chord: 'D' }] },
    ])
  })

  it('keeps chords placed over gaps or past the lyric end', () => {
    const words = buildWords(
      [
        { col: 3, chord: 'Am' },
        { col: 10, chord: 'E7' },
      ],
      'yo   sé'
    )
    expect(words).toEqual([
      { parts: [{ text: 'yo' }] },
      { space: ' ' },
      { parts: [{ text: ' ', chord: 'Am' }] },
      { space: ' ' },
      { parts: [{ text: 'sé' }] },
      { space: ' ' },
      { parts: [{ text: ' ', chord: 'E7' }] },
    ])
  })
})

describe('sectionLabel', () => {
  it('translates Portuguese and English labels', () => {
    expect(sectionLabel('Primeira Parte')).toBe('Primera parte')
    expect(sectionLabel('Pré-Refrão')).toBe('Pre-coro')
    expect(sectionLabel('Refrão Final')).toBe('Coro final')
    expect(sectionLabel('Bridge')).toBe('Puente')
    expect(sectionLabel('INTRO')).toBe('Intro')
  })
})
