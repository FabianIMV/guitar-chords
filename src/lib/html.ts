/** Small HTML helpers shared by the source adapters (run in the browser). */

import { CH_END, CH_START } from './chords'

let textarea: HTMLTextAreaElement | null = null

/** Decode HTML entities (&amp; &#225; &ccedil; ...) using the DOM. */
export function decodeEntities(s: string): string {
  if (!s.includes('&')) return s
  if (!textarea) textarea = document.createElement('textarea')
  textarea.innerHTML = s
  return textarea.value
}

/** Parse an HTML string into a Document for querying. */
export function parseHTML(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

/** Trimmed, whitespace-collapsed text of the first match. */
export function textOf(root: ParentNode, selector: string): string | undefined {
  const t = root.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim()
  return t || undefined
}

/**
 * Turn a chord-sheet element into marked text: elements matching
 * `chordSelector` become \x02chord\x03, <br> becomes a newline, everything
 * else contributes its text (entities decoded, whitespace preserved).
 */
export function elementToMarked(el: Element, chordSelector: string): string {
  const clone = el.cloneNode(true) as Element
  const doc = clone.ownerDocument
  clone.querySelectorAll(chordSelector).forEach((c) => {
    c.replaceWith(doc.createTextNode(CH_START + (c.textContent ?? '') + CH_END))
  })
  clone.querySelectorAll('br').forEach((br) => br.replaceWith(doc.createTextNode('\n')))
  // Hidden helper elements (e.g. screen-reader text) must not leak in.
  clone.querySelectorAll('script, style, button').forEach((n) => n.remove())
  return clone.textContent ?? ''
}

/** Same as elementToMarked for an HTML fragment string. */
export function fragmentToMarked(html: string, chordSelector: string): string {
  const doc = parseHTML(`<pre id="__frag">${html}</pre>`)
  const pre = doc.getElementById('__frag')
  return pre ? elementToMarked(pre, chordSelector) : ''
}

/** Unescape a single-quoted JavaScript string literal body. */
export function unescapeJs(s: string): string {
  return s.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (_, e: string) => {
    if (e[0] === 'u' && e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16))
    if (e[0] === 'x' && e.length === 3) return String.fromCharCode(parseInt(e.slice(1), 16))
    switch (e) {
      case 'n': return '\n'
      case 't': return '\t'
      case 'r': return ''
      default: return e
    }
  })
}

/** Loosely parse JSON that may be wrapped in a JSONP callback or a <pre>. */
export function parseJsonLoose(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    /* try to unwrap */
  }
  const start = raw.search(/[{[]/)
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'))
  if (start >= 0 && end > start) {
    const inner = raw.slice(start, end + 1)
    for (const candidate of [inner, decodeEntities(inner)]) {
      try {
        return JSON.parse(candidate)
      } catch {
        /* next */
      }
    }
  }
  return null
}

/** Remove accents and lowercase: "Música Ligera" → "musica ligera". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** "de-musica-ligera" → "de musica ligera". */
export function prettifySlug(slug: string): string {
  return decodeURIComponent(slug).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
}
