export type SourceId =
  | 'cifraclub'
  | 'ultimate-guitar'
  | 'lacuerda'
  | 'tusacordes'
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
  /** 0..1 quality of this version (ratings, curation): picks the best one. */
  score: number
  /** 0..1 popularity of the song according to the source (rank, votes). */
  popularity?: number
  rating?: number
  votes?: number
  /** Chord sheet or tablature. */
  kind?: 'chords' | 'tab'
  /** Short version label, e.g. "v3". */
  version?: string
  key?: string
  /** Artist/album image. */
  thumb?: string
}

/** A fully fetched, parsed chord sheet. */
export interface SongDetail extends SongSummary {
  lines: Line[]
  /** Capo fret the sheet is written for (0 = none). */
  capoFret?: number
  /** Legacy display string kept for favorites saved by older versions. */
  capo?: string
  key?: string
  tuning?: string
  difficulty?: string
  /** YouTube video id when the source links one. */
  videoId?: string
  fetchedAt?: number
}

export interface RequestOptions {
  signal?: AbortSignal
}

export interface ChordSource {
  id: SourceId
  label: string
  /** Hostnames (without www.) whose pasted URLs this adapter opens. */
  hosts: string[]
  search(query: string, opts?: RequestOptions): Promise<SongSummary[]>
  fetchSong(summary: SongSummary, opts?: RequestOptions): Promise<SongDetail>
}
