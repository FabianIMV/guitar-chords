import type { SongSummary } from '../sources/types'
import { fold } from './html'

/**
 * Ranking and grouping of search results across sources.
 *
 * The same song comes back many times (UG alone often has 10 versions, plus
 * CifraClub, LaCuerda…). We group versions by normalized title + artist,
 * rank groups by how well they match the query and how popular they are,
 * and order the versions inside a group by quality so the first one is the
 * one we open on tap.
 */

export interface SongGroup {
  key: string
  title: string
  artist: string
  versions: SongSummary[]
  best: SongSummary
  relevance: number
  popularity: number
  rank: number
  thumb?: string
}

const STOP = new Set([
  'de', 'la', 'el', 'los', 'las', 'del', 'y', 'e', 'en', 'a', 'o', 'un', 'una',
  'the', 'of', 'and', 'to', 'in', 'da', 'do', 'das', 'dos', 'que', 'mi', 'tu',
])

const NOISE =
  /\b(ao vivo|en vivo|live|acustic[oa]|acoustic|unplugged|version|versao|remaster(ed)?|cover|simplificada|simplified|ver \d+)\b/g

function tokens(s: string): string[] {
  return fold(s)
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** Title normalized for grouping: no accents, brackets, "live", "feat."… */
export function normTitle(title: string): string {
  return tokens(
    fold(title)
      .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
      .replace(/\s(feat|ft|part|con)\.?\s.*$/, ' ')
      .replace(NOISE, ' ')
  ).join(' ')
}

export function normArtist(artist: string): string {
  return tokens(
    fold(artist)
      .replace(/\s(feat|ft|part|con|&|y|e|and|x)\.?\s.*$/, ' ')
      .replace(/^the\s/, '')
  ).join(' ')
}

export function songKey(title: string, artist: string): string {
  return `${normTitle(title)}|${normArtist(artist)}`
}

/** At most one insertion, deletion, substitution or adjacent swap. */
function editDistance1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  if (a.length === b.length) {
    const diff: number[] = []
    for (let k = 0; k < a.length && diff.length <= 2; k++) if (a[k] !== b[k]) diff.push(k)
    if (diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]) {
      return true
    }
  }
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

function tokenMatch(q: string, doc: string[]): number {
  if (doc.includes(q)) return 1
  if (q.length >= 3 && doc.some((d) => d.startsWith(q))) return 0.85
  if (q.length >= 5 && doc.some((d) => d.length >= 4 && editDistance1(q, d))) return 0.7
  return 0
}

/** 0..1: how well a result matches the query (title and artist). */
export function relevance(query: string, title: string, artist: string): number {
  const q = tokens(query)
  if (q.length === 0) return 0
  const t = tokens(title)
  const a = tokens(artist)
  const doc = [...t, ...a]

  let got = 0
  let total = 0
  for (const tok of q) {
    const w = STOP.has(tok) ? 0.3 : 1
    total += w
    got += w * tokenMatch(tok, doc)
  }
  const coverage = total ? got / total : 0

  // How much of the title the query covers ("de musica ligera" fully
  // covers "De Música Ligera" but only part of "… Ligera Solo").
  const titleWords = t.filter((w) => !STOP.has(w))
  const covered = titleWords.filter((w) => q.some((tok) => tokenMatch(tok, [w]) > 0)).length
  const titleCoverage = titleWords.length ? covered / titleWords.length : 0

  return Math.round((0.65 * coverage + 0.35 * titleCoverage) * 1000) / 1000
}

/** Group, rank and sort results. Groups that barely match are dropped. */
export function groupResults(query: string, results: SongSummary[]): SongGroup[] {
  const map = new Map<string, SongSummary[]>()
  for (const r of results) {
    const k = songKey(r.title, r.artist)
    const list = map.get(k)
    if (list) {
      if (!list.some((x) => x.url === r.url)) list.push(r)
    } else map.set(k, [r])
  }

  const groups: SongGroup[] = []
  for (const [key, versions] of map) {
    versions.sort((a, b) => b.score - a.score || (b.votes ?? 0) - (a.votes ?? 0))
    const best = versions[0]
    // Display name: prefer the best-rated chords version's spelling, but a
    // version with accents ("Música") beats one without ("Musica").
    const display =
      versions.find((v) => v.source === 'cifraclub') ??
      versions.find((v) => /[áéíóúñü]/i.test(v.title)) ??
      best
    const rel = Math.max(...versions.map((v) => relevance(query, v.title, v.artist)))
    const sources = new Set(versions.map((v) => v.source)).size
    const pop = Math.min(
      1,
      Math.max(...versions.map((v) => v.popularity ?? 0)) + 0.05 * (sources - 1)
    )
    groups.push({
      key,
      title: display.title,
      artist: display.artist,
      versions,
      best,
      relevance: rel,
      popularity: pop,
      rank: rel * 0.7 + pop * 0.3,
      thumb: versions.find((v) => v.thumb)?.thumb,
    })
  }

  const top = Math.max(0, ...groups.map((g) => g.relevance))
  return groups
    .filter((g) => g.relevance >= Math.min(0.34, top * 0.6))
    .sort((a, b) => b.rank - a.rank)
}
