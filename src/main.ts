import '@fontsource-variable/figtree'
import './style.css'
import './app.css'
import {
  accountLoadFailed,
  get,
  isSignedIn,
  refreshInbox,
  releaseScheduled,
  retryAccount,
  subscribe,
  syncAccount,
} from './store.ts'
import { cloudEnabled, currentUserId, watchAuth } from './cloud.ts'
import { stopViewing } from './published.ts'
import { renderLogin } from './login.ts'
import { current, go, isAnchorHash } from './router.ts'
import { bind } from './ui.ts'
import { renderLanding } from './landing.ts'
import { renderStart } from './start.ts'
import { renderDashboard } from './dashboard.ts'
import { appBusiness, brandColor, renderApp } from './app.ts'
import { register } from './ui.ts'

const root = document.querySelector<HTMLDivElement>('#app')!
const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
const SITE_TITLE = document.title
const SITE_COLOR = themeMeta?.content ?? '#f7f8f6'

bind(root)

let lastKey = ''

function render(): void {
  // Plain #anchors are in-page jumps on the landing page, not routes.
  if (isAnchorHash()) return

  const { path, params } = current()
  const [section, ...sub] = path
  const biz = get().business

  let html: string
  let view: 'site' | 'start' | 'dash' | 'app'
  let title = SITE_TITLE
  let color = SITE_COLOR

  if (section !== 'a') stopViewing()

  // Signed in, but the account would not load: say so rather than sending them to set up a second app.
  if (cloudEnabled && isSignedIn() && accountLoadFailed() && (section === 'start' || section === 'dashboard' || section === 'login')) {
    html = `<main class="wrap start" id="start-main" tabindex="-1">
      <h1>We Could Not Load Your Account</h1>
      <p class="lead">Check your connection, then try again.</p>
      <p><button class="btn" type="button" data-action="retryAccount">Try Again</button></p>
    </main>`
    view = 'start'
  } else if (!section) {
    html = renderLanding()
    view = 'site'
  } else if (section === 'login') {
    if (!cloudEnabled) return go('/start')
    if (isSignedIn()) return go(biz ? '/dashboard' : '/start')
    html = renderLogin(params)
    view = 'start'
    title = `Sign In | ${SITE_TITLE}`
  } else if (section === 'start') {
    if (cloudEnabled && !isSignedIn()) return go('/login?mode=signup')
    if (biz) return go('/dashboard')
    html = renderStart()
    view = 'start'
    title = `Set Up Your App | ${SITE_TITLE}`
  } else if (section === 'dashboard') {
    if (cloudEnabled && !isSignedIn()) return go('/login')
    if (!biz) return go('/start')
    html = renderDashboard(sub, params)
    view = 'dash'
    title = `Dashboard | ${biz.name}`
  } else if (section === 'a') {
    html = renderApp(sub, params)
    view = 'app'
    const shown = appBusiness(sub[0] ?? '')
    if (shown) {
      title = shown.name
      color = brandColor(shown)
    }
  } else {
    return go('/')
  }

  document.body.dataset.view = view
  document.title = title
  if (themeMeta) themeMeta.content = color
  root.innerHTML = html

  // New page: start at the top and move focus to it. Same page redrawn: leave the reader where they are.
  const key = location.hash
  if (key !== lastKey) {
    lastKey = key
    window.scrollTo(0, 0)
    if (view !== 'site') root.querySelector<HTMLElement>('#main, #start-main')?.focus({ preventScroll: true })
  }
}

// Data changes redraw the page, except where a redraw would destroy something in progress:
// the preview iframe (it would jump back to Home) or text the owner is still typing.
subscribe(() => {
  if (current().path.join('/') === 'dashboard/preview') return
  const active = document.activeElement
  if (active && root.contains(active) && active.matches('input:not([readonly]), textarea, select')) return
  render()
})
window.addEventListener('hashchange', render)

register({
  retryAccount: () => void retryAccount(),
})

// Scheduled notifications go out when their time arrives.
setInterval(releaseScheduled, 30_000)

// Customers add enquiries and subscribers while the owner has the dashboard open.
setInterval(() => {
  if (!document.hidden) void refreshInbox()
}, 20_000)

async function boot(): Promise<void> {
  if (cloudEnabled) {
    root.innerHTML = '<p class="boot" role="status" style="padding:2rem">Loading…</p>'
    // A sign-in link lands here as ?code=..., which the client exchanges for a session on start-up.
    const cameFromLink = new URLSearchParams(location.search).has('code')
    try {
      await syncAccount(await currentUserId())
    } catch {
      // syncAccount reports its own failure.
    }
    if (cameFromLink) {
      history.replaceState(null, '', `${location.pathname}${location.hash}`)
      if (isSignedIn() && !location.hash.startsWith('#/a/')) location.hash = '#/dashboard'
    }
    watchAuth((id) => void syncAccount(id))
  } else {
    releaseScheduled()
  }
  render()
}

void boot()
