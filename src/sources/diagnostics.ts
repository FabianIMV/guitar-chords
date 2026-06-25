import { logDebug } from '../lib/debug'

/**
 * When a search adapter finds no song links, log a sample of the internal
 * links actually present on the page. This lets us calibrate the search URL
 * and link pattern straight from the in-app debug log, without pasting HTML.
 */
export function logSampleLinks(label: string, doc: Document): void {
  const hrefs: string[] = []
  const seen = new Set<string>()
  for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
    const href = a.getAttribute('href') || ''
    // Skip anchors, external assets and obvious nav noise.
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue
    const path = href.replace(/^https?:\/\/[^/]+/, '')
    if (!path.startsWith('/') || path.length < 3) continue
    if (seen.has(path)) continue
    seen.add(path)
    hrefs.push(path)
    if (hrefs.length >= 12) break
  }
  const title = doc.querySelector('title')?.textContent?.trim() || '(sin título)'
  logDebug({
    kind: 'info',
    label: `${label}: 0 links de canción`,
    detail: `título="${title.slice(0, 60)}" · enlaces: ${hrefs.join(' , ') || '(ninguno)'}`,
  })
}
