import '@fontsource-variable/figtree'
import './style.css'
import './app.css'
import { get, releaseScheduled, subscribe } from './store.ts'
import { current, go, isAnchorHash } from './router.ts'
import { bind } from './ui.ts'
import { renderLanding } from './landing.ts'
import { renderStart } from './start.ts'
import { renderDashboard } from './dashboard.ts'
import { brandColor, renderApp } from './app.ts'

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

  if (!section) {
    html = renderLanding()
    view = 'site'
  } else if (section === 'start') {
    if (biz) return go('/dashboard')
    html = renderStart()
    view = 'start'
    title = `Set Up Your App | ${SITE_TITLE}`
  } else if (section === 'dashboard') {
    if (!biz) return go('/start')
    html = renderDashboard(sub, params)
    view = 'dash'
    title = `Dashboard | ${biz.name}`
  } else if (section === 'a') {
    html = renderApp(sub, params)
    view = 'app'
    if (biz && biz.slug === sub[0]) {
      title = biz.name
      color = brandColor(biz)
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

// Scheduled notifications go out when their time arrives.
setInterval(releaseScheduled, 30_000)
releaseScheduled()
render()
