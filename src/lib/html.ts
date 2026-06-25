/** Small HTML helpers that run in the browser. */

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
