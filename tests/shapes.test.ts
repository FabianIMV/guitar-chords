import { getChordShape } from '../src/lib/chordShapes.ts'
import { transposeChord, looksLikeChord } from '../src/lib/chords.ts'

let fails = 0
const eq = (a: unknown, b: unknown, msg: string) => {
  const ok = JSON.stringify(a) === JSON.stringify(b)
  if (!ok) { fails++; console.log('FAIL', msg, '=>', JSON.stringify(a), '!=', JSON.stringify(b)) }
  else console.log('ok  ', msg)
}
const truthy = (v: unknown, msg: string) => eq(Boolean(v), true, msg)

// --- Open & curated shapes
eq(getChordShape('C')?.frets, [-1, 3, 2, 0, 1, 0], 'C open')
eq(getChordShape('Bm')?.frets, [-1, 2, 4, 4, 3, 2], 'Bm curated barre')
eq(getChordShape('F#m')?.frets, [2, 4, 4, 2, 2, 2], 'F#m curated barre')
eq(getChordShape('Gm')?.frets, [3, 5, 5, 3, 3, 3], 'Gm curated')
eq(getChordShape('Bb')?.frets, [-1, 1, 3, 3, 3, 1], 'Bb curated')
eq(getChordShape('D/F#')?.frets, [2, -1, 0, 2, 3, 2], 'D/F# slash shape')
eq(getChordShape('G/B')?.frets, [-1, 2, 0, 0, 3, 3], 'G/B slash shape')
eq(getChordShape('Cadd9')?.frets, [-1, 3, 2, 0, 3, 0], 'Cadd9 open')

// --- sus family (incl. Brazilian "D4"/"A2")
eq(getChordShape('Asus2')?.frets, [-1, 0, 2, 2, 0, 0], 'Asus2 open')
eq(getChordShape('A2')?.frets, [-1, 0, 2, 2, 0, 0], 'A2 = Asus2')
eq(getChordShape('Dsus4')?.frets, [-1, -1, 0, 2, 3, 3], 'Dsus4 open')
eq(getChordShape('D4')?.frets, [-1, -1, 0, 2, 3, 3], 'D4 = Dsus4')
eq(getChordShape('Bsus4')?.frets, [-1, 2, 4, 4, 5, 2], 'Bsus4 A-form barre')
eq(getChordShape('Esus4')?.frets, [0, 2, 2, 2, 0, 0], 'Esus4 open')
eq(getChordShape('A7sus4')?.frets, [-1, 0, 2, 0, 3, 0], 'A7sus4 open')

// --- Brazilian spellings
eq(getChordShape('C7M')?.frets, getChordShape('Cmaj7')?.frets, 'C7M = Cmaj7')
truthy(getChordShape('Bº'), 'Bº (dim) has a shape')
eq(getChordShape('Bº')?.frets, [-1, 2, 3, 1, 3, -1], 'Bdim7 5th-string shape')
eq(getChordShape('Bm7(5-)')?.frets, [-1, 2, 3, 2, 3, -1], 'Bm7(5-) = Bm7b5')
eq(getChordShape('Am7(5-)')?.frets, [-1, 12, 13, 12, 13, -1], 'Am7b5 at 12th (A root)')

// --- Movable barres still fine
eq(getChordShape('G#m7')?.frets, [4, 6, 4, 4, 4, 4], 'G#m7 E-form at 4')
eq(getChordShape('C#m7')?.frets, [-1, 4, 6, 4, 5, 4], 'C#m7 A-form at 4')

// --- 9/11/13 approximate to dominant shape
const c9 = getChordShape('C9')
truthy(c9 && c9.approximate, 'C9 approximates (flagged ≈)')

// --- Slash without dedicated shape → main chord, approx
const amG = getChordShape('Am/G')
eq(amG?.frets, [-1, 0, 2, 2, 1, 0], 'Am/G falls back to Am')
truthy(amG?.approximate, 'Am/G flagged ≈')

// --- transpose regression
eq(transposeChord('G/B', 2), 'A/C#', 'transpose slash')
eq(transposeChord('C7M', 2), 'D7M', 'transpose keeps 7M suffix')

// --- looksLikeChord accepts new spellings
for (const c of ['C7M', 'Bº', 'Am7(5-)', 'D4', 'A2', 'E5+', 'D/F#']) {
  truthy(looksLikeChord(c), `looksLikeChord(${c})`)
}
for (const w of ['Amor', 'De', 'la', 'Fue']) {
  eq(looksLikeChord(w), false, `not a chord: ${w}`)
}

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILED`)
process.exit(fails === 0 ? 0 : 1)
