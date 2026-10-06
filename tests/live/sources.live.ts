import { describe, expect, it } from 'vitest'
import { SOURCES } from '../../src/sources'
import { groupResults } from '../../src/lib/search'
import { uniqueChords } from '../../src/lib/chords'
import { getRouteHealth } from '../../src/lib/proxy'
import type { SourceId } from '../../src/sources/types'

/**
 * End-to-end check of every searchable source against the real sites,
 * through the real fetch routes (Worker → Jina → public proxies). Run it
 * before shipping scraping changes; sites change their markup without
 * notice.
 */
const CASES: Array<[SourceId, string, RegExp]> = [
  ['cifraclub', 'de musica ligera soda stereo', /m[uú]sica ligera/i],
  ['ultimate-guitar', 'hotel california', /hotel california/i],
  ['lacuerda', 'de musica ligera', /m[uú]sica ligera/i],
  ['tusacordes', 'de musica ligera', /m[uú]sica ligera/i],
]

describe.each(CASES)('%s', (id, query, expected) => {
  it(`searches "${query}" and opens the best result`, async () => {
    const source = SOURCES[id]
    const t0 = performance.now()
    const results = await source.search(query)
    const t1 = performance.now()
    expect(results.length).toBeGreaterThan(0)
    const [group] = groupResults(query, results)
    expect(group.title).toMatch(expected)

    const song = await source.fetchSong(group.best)
    const t2 = performance.now()
    const chords = uniqueChords(song.lines)
    console.log(
      `${id}: ${results.length} results in ${Math.round(t1 - t0)}ms; ` +
        `"${song.title}" — ${song.artist} [${song.key ?? '?'}${song.capoFret ? `, capo ${song.capoFret}` : ''}] ` +
        `${song.lines.length} lines, chords ${chords.join(' ')} in ${Math.round(t2 - t1)}ms`
    )
    expect(chords.length).toBeGreaterThan(2)
    expect(song.lines.length).toBeGreaterThan(10)
  })
})

describe('routes', () => {
  it('logs what each host used', () => {
    for (const h of getRouteHealth()) console.log(h.key, `ok=${h.ok} fail=${h.fail} ${h.ms}ms`)
  })
})
