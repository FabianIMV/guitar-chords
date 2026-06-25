import { logDebug } from '../lib/debug'

/**
 * When a search adapter finds no song links, log clues for calibration:
 *  - a sample of internal links present on the page, and
 *  - any URLs in the raw HTML/JS that look like a search/API endpoint
 *    (many sites load results via AJAX, so the real endpoint is referenced
 *    in the page source rather than rendered as links).
 * This lets us calibrate the search endpoint straight from the debug log.
 */
export function logSampleLinks(label: string, doc: Document, html?: string): void {
  const hrefs: string[] = []
  const seen = new Set<string>()
  for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
    const href = a.getAttribute('href') || ''
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

  // Scan the raw source for likely search/API endpoints.
  if (html) {
    const hints = new Set<string>()
    const re = /["'`(]((?:https?:)?\/\/?[^"'`\s)]*(?:busca|search|api|autocomplete|typeahead|suggest|query|results?)[^"'`\s)]*)/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) && hints.size < 12) {
      const u = m[1]
      if (u.length > 4 && u.length < 160) hints.add(u)
    }
    if (hints.size) {
      logDebug({
        kind: 'info',
        label: `${label}: posibles endpoints en el HTML`,
        detail: [...hints].join('  ·  '),
      })
    }
  }
}
