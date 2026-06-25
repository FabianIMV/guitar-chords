export type SourceId =
  | 'cifraclub'
  | 'ultimate-guitar'
  | 'tusacordes'
  | 'lacuerda'
  | 'cifras'

/** A single token on a line: either a chord or plain (lyric/whitespace) text. */
export interface Token {
  text: string
  chord: boolean
}

export interface Line {
  tokens: Token[]
}

/** A search result before we fetch the full chord sheet. */
export interface SongSummary {
  id: string
  source: SourceId
  title: string
  artist: string
  url: string
  /** Normalized 0..1 quality score used to sort results (best first). */
  score: number
  rating?: number
  votes?: number
}

/** A fully fetched, parsed chord sheet. */
export interface SongDetail extends SongSummary {
  lines: Line[]
  capo?: string
  key?: string
  tuning?: string
}

export interface ChordSource {
  id: SourceId
  label: string
  search(query: string): Promise<SongSummary[]>
  fetchSong(summary: SongSummary): Promise<SongDetail>
}
