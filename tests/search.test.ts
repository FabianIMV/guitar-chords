import { describe, expect, it } from 'vitest'
import { groupResults, normTitle, relevance, songKey } from '../src/lib/search'
import type { SongSummary } from '../src/sources/types'

const s = (p: Partial<SongSummary> & Pick<SongSummary, 'title' | 'artist' | 'source'>): SongSummary => ({
  id: `${p.source}:${p.url ?? p.title + p.artist + Math.random()}`,
  url: p.url ?? `${p.source}/${p.title}/${Math.random()}`,
  score: 0.5,
  ...p,
})

describe('normalization', () => {
  it('groups spelling variants of the same song', () => {
    expect(songKey('De Música Ligera', 'Soda Stereo')).toBe(songKey('De Musica Ligera', 'Soda Stereo'))
    expect(songKey('Hotel California', 'Eagles')).toBe(songKey('Hotel California (Ao Vivo)', 'The Eagles'))
    expect(songKey('Despacito', 'Luis Fonsi feat. Daddy Yankee')).toBe(songKey('Despacito', 'Luis Fonsi'))
    expect(normTitle('Hotel California (ver 2)')).toBe('hotel california')
  })
})

describe('relevance', () => {
  it('prefers full title matches', () => {
    const full = relevance('de musica ligera', 'De Música Ligera', 'Soda Stereo')
    const partial = relevance('de musica ligera', 'De Musica Ligera Solo', 'Soda Stereo')
    const other = relevance('de musica ligera', 'Persiana Americana', 'Soda Stereo')
    expect(full).toBe(1)
    expect(partial).toBeLessThan(full)
    expect(other).toBeLessThan(0.3)
  })
  it('matches artist + title queries and typos', () => {
    expect(relevance('hotel california eagles', 'Hotel California', 'Eagles')).toBe(1)
    expect(relevance('hotel califronia', 'Hotel California', 'Eagles')).toBeGreaterThan(0.6)
    expect(relevance('soda', 'Persiana Americana', 'Soda Stereo')).toBeGreaterThan(0.6)
  })
})

describe('groupResults', () => {
  const results = [
    s({ source: 'cifraclub', title: 'De Música Ligera', artist: 'Soda Stereo', score: 0.86, popularity: 1 }),
    s({ source: 'ultimate-guitar', title: 'De Musica Ligera', artist: 'Soda Stereo', score: 0.93, votes: 900, popularity: 0.6 }),
    s({ source: 'ultimate-guitar', title: 'De Musica Ligera', artist: 'Soda Stereo', score: 0.7, votes: 20, kind: 'tab' }),
    s({ source: 'lacuerda', title: 'De Música Ligera', artist: 'Soda Stereo', score: 0.78, popularity: 0.55 }),
    s({ source: 'cifraclub', title: 'De Música Ligera', artist: 'Coldplay', score: 0.86, popularity: 0.37 }),
    s({ source: 'tusacordes', title: 'Nada que ver', artist: 'Otro', score: 0.6, popularity: 0.3 }),
  ]
  const groups = groupResults('de musica ligera', results)

  it('merges versions across sources and drops unrelated songs', () => {
    expect(groups.map((g) => g.artist)).toEqual(['Soda Stereo', 'Coldplay'])
    expect(groups[0].versions).toHaveLength(4)
  })
  it('opens the best-rated version first', () => {
    expect(groups[0].best.source).toBe('ultimate-guitar')
    expect(groups[0].versions.map((v) => v.score)).toEqual([0.93, 0.86, 0.78, 0.7])
  })
  it('keeps the accented display title', () => {
    expect(groups[0].title).toBe('De Música Ligera')
  })
})
