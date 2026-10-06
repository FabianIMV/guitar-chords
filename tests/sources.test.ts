import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCifraClubSearch, parseCifraClubSong, parseCapo } from '../src/sources/cifraclub'
import { parseUGSearch, parseUGSong, ugQuality } from '../src/sources/ultimateGuitar'
import { parseLaCuerdaSearch, parseLaCuerdaSong } from '../src/sources/lacuerda'
import { parseTusAcordesSearch, parseTusAcordesSong } from '../src/sources/tusacordes'
import { summaryFromUrl } from '../src/sources'
import { uniqueChords } from '../src/lib/chords'
import type { Line, SongSummary } from '../src/sources/types'

// Fixtures mirror each site's real markup (captured October 2026) with
// invented lyrics.
const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8')
const base: SongSummary = { id: 'x', source: 'cifraclub', title: 'T', artist: 'A', url: 'u', score: 1 }
const text = (l: Line) => l.tokens.map((t) => t.text).join('')
const chordsOf = (l: Line) => l.tokens.filter((t) => t.chord).map((t) => t.text)

describe('CifraClub', () => {
  it('parses SOLR search: songs only, popularity, thumbnails, entities', () => {
    const res = parseCifraClubSearch(fixture('cifraclub-search.json'))
    expect(res).toHaveLength(2)
    expect(res[0]).toMatchObject({
      title: 'Canción de Prueba',
      artist: 'Los Ejemplos',
      url: 'https://www.cifraclub.com.br/los-ejemplos/cancion-de-prueba/',
      popularity: 1,
      thumb: 'https://akamai.sscdn.co/uploadfile/letras/fotos/a/b/c/d/abcd-tb.jpg',
    })
    expect(res[1].popularity).toBeCloseTo(0.25)
  })

  it('parses the Next.js song page: sheet, key, capo, tuning', () => {
    const song = parseCifraClubSong(fixture('cifraclub-song.html'), base)
    expect(song.title).toBe('Canción de Prueba')
    expect(song.artist).toBe('Los Ejemplos')
    expect(song.key).toBe('Em')
    expect(song.capoFret).toBe(2)
    expect(song.tuning).toBeUndefined() // "Padrão" = standard
    expect(uniqueChords(song.lines)).toEqual(['Em', 'C', 'G', 'D', 'D/F#', 'C7M', 'Am7(5-)'])
    const lyric = song.lines.find((l) => text(l).includes('Una línea'))!
    expect(text(lyric)).toBe('Una línea de prueba & algo')
    // Chord columns are preserved for alignment.
    const chordLine = song.lines[song.lines.indexOf(lyric) - 1]
    expect(text(chordLine).indexOf('C')).toBe(12)
    expect(song.lines.some((l) => text(l).startsWith('E|-----0'))).toBe(true)
  })

  it('reads capo texts', () => {
    expect(parseCapo('Sem capotraste')).toBe(0)
    expect(parseCapo('3ª casa')).toBe(3)
    expect(parseCapo(undefined)).toBeUndefined()
  })
})

describe('Ultimate Guitar', () => {
  it('parses desktop JSON search, keeping chords/tabs only', () => {
    const res = parseUGSearch(fixture('ug-search-desktop.html'))
    expect(res.map((r) => r.kind)).toEqual(['chords', 'chords', 'tab'])
    expect(res[0]).toMatchObject({ title: 'Song Test', artist: 'The Examples', rating: 4.9, votes: 5000, version: 'v1', key: 'G' })
    // 4.9★ from 5000 votes beats 5★ from 3 votes.
    expect(res[0].score).toBeGreaterThan(res[1].score)
  })

  it('parses the mobile list (iPhone UA)', () => {
    const res = parseUGSearch(fixture('ug-search-mobile.html'))
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ title: 'Song Test', artist: 'The Examples', rating: 4.5, votes: 1234, kind: 'chords', version: 'v2' })
  })

  it('parses a tab page', () => {
    const song = parseUGSong(fixture('ug-song.html'), { ...base, source: 'ultimate-guitar' })
    expect(song).toMatchObject({ title: 'Song Test', capoFret: 3, key: 'Bb', difficulty: 'Intermedio', tuning: undefined })
    expect(uniqueChords(song.lines)).toEqual(['G', 'D', 'Em', 'C'])
    const lyric = song.lines.find((l) => text(l).includes('letra inventada'))!
    expect(text(lyric)).toBe('  Una letra inventada aqui')
  })

  it('ranks by Bayesian rating', () => {
    expect(ugQuality(4.85, 40000, 'chords')).toBeGreaterThan(ugQuality(5, 4, 'chords'))
    expect(ugQuality(4.8, 900, 'tab')).toBeLessThan(ugQuality(4.8, 900, 'chords'))
  })
})

describe('LaCuerda', () => {
  it('parses iapp.php search with chord versions', () => {
    const res = parseLaCuerdaSearch(fixture('lacuerda-search.js'))
    expect(res.map((r) => [r.title, r.artist, r.url, r.version])).toEqual([
      ['Canción de Prueba', 'Los Ejemplos', 'https://acordes.lacuerda.net/los_ejemplos/cancion_de_prueba.shtml', 'v1'],
      ['Canción de Prueba', 'Los Ejemplos', 'https://acordes.lacuerda.net/los_ejemplos/cancion_de_prueba-3.shtml', 'v2'],
      ["L'amour", 'Otro', 'https://acordes.lacuerda.net/otro/con_comilla.shtml', undefined],
    ])
  })

  it('parses the desktop page (#t_body pre, <A> chords)', () => {
    const song = parseLaCuerdaSong(fixture('lacuerda-song-desktop.html'), base)
    expect(song.title).toBe('Canción de Prueba')
    expect(song.artist).toBe('Los Ejemplos')
    expect(uniqueChords(song.lines)).toEqual(['Am', 'F', 'C', 'G'])
    expect(song.lines.some((l) => text(l) === 'Una línea de prueba')).toBe(true)
  })

  it('parses the mobile page (res.body JS strings)', () => {
    const song = parseLaCuerdaSong(fixture('lacuerda-song-mobile.html'), base)
    expect(song.title).toBe('Canción de Prueba')
    expect(song.videoId).toBe('abcDEF12345')
    expect(uniqueChords(song.lines)).toEqual(['Am', 'F', 'C', 'G'])
    expect(song.lines.some((l) => text(l) === "Una línea de 'prueba'")).toBe(true)
  })
})

describe('TusAcordes', () => {
  it('parses search: chord versions only, numbered', () => {
    const res = parseTusAcordesSearch(fixture('tusacordes-search.html'))
    expect(res.map((r) => [r.title, r.artist, r.version])).toEqual([
      ['Cancion de Prueba', 'Los Ejemplos', 'v1'],
      ['Cancion de Prueba', 'Los Ejemplos', 'v2'],
      ['Única', 'Otro', undefined],
    ])
  })

  it('parses a song in Latin notation', () => {
    const song = parseTusAcordesSong(fixture('tusacordes-song.html'), base)
    expect(song.title).toBe('Cancion de Prueba')
    expect(song.artist).toBe('Los Ejemplos')
    expect(uniqueChords(song.lines)).toEqual(['Am', 'F', 'C', 'G7'])
    // "Do       SOL7" → "C        G7  ": G7 stays at column 9.
    const line = song.lines.find((l) => chordsOf(l).includes('C'))!
    expect(text(line)).toBe('C        G7  ')
  })
})

describe('pasted URLs', () => {
  it.each([
    ['https://www.cifraclub.com.br/soda-stereo/de-musica-ligera/', 'cifraclub', 'de musica ligera', 'soda stereo'],
    ['https://tabs.ultimate-guitar.com/tab/eagles/hotel-california-chords-46190', 'ultimate-guitar', 'hotel california', 'eagles'],
    ['https://acordes.lacuerda.net/soda_stereo/de_musica_ligera-2.shtml', 'lacuerda', 'de musica ligera', 'soda stereo'],
    ['https://www.tusacordes.com/tab/x-y-acordes-1', 'tusacordes', 'x y', ''],
  ])('%s', (url, source, title, artist) => {
    expect(summaryFromUrl(url)).toMatchObject({ source, title, artist, url })
  })
  it('ignores other text', () => {
    expect(summaryFromUrl('hotel california')).toBeNull()
    expect(summaryFromUrl('https://example.com/x')).toBeNull()
  })
})
