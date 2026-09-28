import { cloudEnabled, fetchPublic } from './cloud.ts'
import { emptyState, get, notify } from './store.ts'
import type { State } from './store.ts'

// What a customer sees when they open #/a/<slug>. In local mode that is the owner's own data.
// In cloud mode it is the published app, fetched by slug and re-checked while the page is open
// so new posts and notifications arrive without a reload.
export type View =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error' }
  | { kind: 'ready'; state: State }

interface Entry {
  view: View
  sig: string
}

const cache = new Map<string, Entry>()
let watching = ''
let ticker: number | undefined

// The owner's live preview sits in an iframe, so check it more often.
const INTERVAL = window.self !== window.top ? 5_000 : 15_000

export function viewApp(slug: string): View {
  if (!cloudEnabled) {
    const s = get()
    return s.business?.slug === slug ? { kind: 'ready', state: s } : { kind: 'missing' }
  }
  watch(slug)
  return cache.get(slug)?.view ?? { kind: 'loading' }
}

/** Stop checking for updates once the customer app is no longer on screen. */
export function stopViewing(): void {
  clearInterval(ticker)
  watching = ''
}

export const retry = (slug: string): Promise<void> => refresh(slug)

function watch(slug: string): void {
  if (watching === slug) return
  clearInterval(ticker)
  watching = slug
  void refresh(slug)
  ticker = window.setInterval(() => {
    if (!document.hidden) void refresh(slug)
  }, INTERVAL)
}

async function refresh(slug: string): Promise<void> {
  try {
    const data = await fetchPublic(slug)
    const sig = JSON.stringify(data)
    if (cache.get(slug)?.sig === sig) return
    cache.set(slug, {
      sig,
      view: data ? { kind: 'ready', state: { ...emptyState(), ...data } } : { kind: 'missing' },
    })
  } catch {
    // A failed check while the app is already on screen is not worth interrupting anyone for.
    if (cache.get(slug)?.view.kind === 'ready') return
    cache.set(slug, { sig: '', view: { kind: 'error' } })
  }
  notify()
}
