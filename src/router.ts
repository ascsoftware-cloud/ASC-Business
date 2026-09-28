export interface Route {
  path: string[]
  params: URLSearchParams
}

/** Routes look like #/dashboard/news?edit=ID. Plain #anchors belong to the landing page. */
export const isAnchorHash = (): boolean => location.hash !== '' && !location.hash.startsWith('#/')

export function current(): Route {
  const raw = location.hash.replace(/^#\/?/, '')
  const [p = '', q = ''] = raw.split('?')
  return { path: p.split('/').filter(Boolean), params: new URLSearchParams(q) }
}

export function go(to: string): void {
  location.hash = to
}
