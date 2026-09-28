import { mutate, newId, notify } from './store.ts'
import type { Business, Field, State } from './store.ts'
import { cloudEnabled, submitAnswers, subscribeDevice, unsubscribeDevice } from './cloud.ts'
import { retry, viewApp } from './published.ts'
import { go } from './router.ts'
import { formData, register, toast } from './ui.ts'
import { esc, fmtDate, fmtDay, isHex, paragraphs, readableOn, safeUrl } from './util.ts'

interface Viewer {
  subscribed: boolean
  seen: string[]
  /** Stands in for this phone when notifications are on. Never leaves the device except as a random id. */
  device: string
}

const viewerKey = (slug: string) => `asc-business:viewer:${slug}`

function loadViewer(slug: string): Viewer {
  try {
    const v = JSON.parse(localStorage.getItem(viewerKey(slug)) ?? '{}') as Partial<Viewer>
    return { subscribed: !!v.subscribed, seen: Array.isArray(v.seen) ? v.seen : [], device: v.device || newId() }
  } catch {
    return { subscribed: false, seen: [], device: newId() }
  }
}

function saveViewer(slug: string, v: Viewer): void {
  try {
    localStorage.setItem(viewerKey(slug), JSON.stringify(v))
  } catch {
    // Not persisted, still works this session.
  }
}

const tabs = [
  { key: 'home', label: 'Home' },
  { key: 'news', label: 'News' },
  { key: 'events', label: 'Events' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'contact', label: 'Contact' },
] as const

export const brandColor = (b: Business): string => (isHex(b.color) ? b.color : '#0a6650')

// The app being shown: the owner's own data locally, the published app from the cloud otherwise.
let cur: State = { business: null, posts: [], events: [], notices: [], forms: [], submissions: [], links: [], subscribers: [] }

/** The business behind an app address once it has loaded, for the page title and colour. */
export function appBusiness(slug: string): Business | null {
  const v = viewApp(slug)
  return v.kind === 'ready' ? v.state.business : null
}

// Notifications the viewer has already been told about in this session.
let known: Set<string> | null = null

function announceNew(slug: string, viewer: Viewer): void {
  const sent = cur.notices.filter((n) => n.status === 'sent')
  if (known === null) {
    known = new Set(sent.map((n) => n.id))
    return
  }
  for (const n of sent) {
    if (known.has(n.id)) continue
    known.add(n.id)
    if (!viewer.subscribed) continue
    toast(`New notification: ${n.title}`)
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(cur.business?.name ?? slug, { body: `${n.title}. ${n.body}` })
      }
    } catch {
      // Some browsers only allow notifications from a service worker.
    }
  }
}

function unavailable(slug: string, kind: 'loading' | 'missing' | 'error'): string {
  if (kind === 'loading') {
    return `<main class="capp-missing" id="main" tabindex="-1" role="status"><p>Loading…</p></main>`
  }
  if (kind === 'error') {
    return `<main class="capp-missing" id="main" tabindex="-1">
      <h1>Can’t Reach This App</h1>
      <p>Check your connection. We will keep trying.</p>
      <p><button class="btn" type="button" data-action="retryApp" data-slug="${esc(slug)}">Try Again</button></p>
    </main>`
  }
  return `<main class="capp-missing" id="main" tabindex="-1">
    <h1>This App Isn’t Available</h1>
    <p>${
      cloudEnabled
        ? 'We could not find an app at this address. Check the link with the business that sent it.'
        : 'Apps are stored in the browser they were built in for now, so this link only works on the device that created it.'
    }</p>
    <p><a class="btn" href="#/">Go to the Home Page</a></p>
  </main>`
}

export function renderApp(sub: string[], params: URLSearchParams): string {
  const view = viewApp(sub[0] ?? '')
  if (view.kind !== 'ready') return unavailable(sub[0] ?? '', view.kind)
  const s = view.state
  const biz = s.business
  if (!biz) return unavailable(sub[0] ?? '', 'missing')
  cur = s

  const viewer = loadViewer(biz.slug)
  announceNew(biz.slug, viewer)

  const tab = tabs.find((t) => t.key === sub[1])?.key ?? 'home'
  const sent = s.notices
    .filter((n) => n.status === 'sent')
    .sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt))
  const unseen = sent.filter((n) => !viewer.seen.includes(n.id))

  let body: string
  switch (tab) {
    case 'news':
      body = viewNews()
      break
    case 'events':
      body = viewEvents()
      break
    case 'alerts':
      body = viewAlerts(biz, viewer, sent, new Set(unseen.map((n) => n.id)))
      viewer.seen = sent.map((n) => n.id)
      saveViewer(biz.slug, viewer)
      break
    case 'contact':
      body = viewContact(biz, params.get('form'))
      break
    default:
      body = viewHome(biz, viewer)
  }
  const badge = tab === 'alerts' ? 0 : unseen.length

  const color = brandColor(biz)
  return `
    <div class="capp" style="--brand:${color};--on-brand:${readableOn(color)}">
      <header class="capp-head">
        <p class="capp-name" translate="no">${esc(biz.name)}</p>
        ${biz.tagline ? `<p class="capp-tag">${esc(biz.tagline)}</p>` : ''}
      </header>
      <main class="capp-main" id="main" tabindex="-1">${body}</main>
      <nav class="tabbar" aria-label="App">
        ${tabs
          .map(
            (t) => `<a href="#/a/${esc(biz.slug)}${t.key === 'home' ? '' : `/${t.key}`}" ${t.key === tab ? 'aria-current="page"' : ''}>${t.label}${
              t.key === 'alerts' && badge
                ? `<span class="dot" aria-label="${badge} new"></span>`
                : ''
            }</a>`,
          )
          .join('')}
      </nav>
    </div>`
}

function subscribeBlock(biz: Business, viewer: Viewer): string {
  return viewer.subscribed
    ? `<section class="capp-block" aria-labelledby="sub-h">
        <h2 id="sub-h">Notifications Are On</h2>
        <p>You will see offers and updates from ${esc(biz.name)} on the Alerts tab.</p>
        <button class="btn btn-quiet" type="button" data-action="unsubscribe" data-slug="${esc(biz.slug)}">Turn Off Notifications</button>
      </section>`
    : `<section class="capp-block" aria-labelledby="sub-h">
        <h2 id="sub-h">Never Miss an Offer</h2>
        <p>Turn on notifications to hear about specials and changes first.</p>
        <button class="btn" type="button" data-action="subscribe" data-slug="${esc(biz.slug)}">Turn On Notifications</button>
      </section>`
}

function postCard(p: { title: string; body: string; createdAt: string; pinned: boolean }): string {
  return `<article class="capp-post">
    <h3>${esc(p.title)}${p.pinned ? ' <span class="tag">Pinned</span>' : ''}</h3>
    <p class="meta">${fmtDate(p.createdAt)}</p>
    <div class="prose">${paragraphs(p.body)}</div>
  </article>`
}

const sortedPosts = () =>
  [...cur.posts].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.createdAt) - +new Date(a.createdAt),
  )

const upcoming = () =>
  [...cur.events]
    .filter((e) => +new Date(e.date) >= Date.now() - 3_600_000)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))

function viewHome(biz: Business, viewer: Viewer): string {
  const posts = sortedPosts().slice(0, 2)
  const next = upcoming()[0]
  return `
    <h1 class="sr-only">Home</h1>
    ${subscribeBlock(biz, viewer)}
    ${
      next
        ? `<section class="capp-block" aria-labelledby="next-h">
            <h2 id="next-h">Coming Up</h2>
            <p class="strong">${esc(next.title)}</p>
            <p class="meta">${fmtDate(next.date)}${next.location ? `, ${esc(next.location)}` : ''}</p>
            <p><a class="text-link" href="#/a/${esc(biz.slug)}/events">See All Events</a></p>
          </section>`
        : ''
    }
    <section aria-labelledby="latest-h" class="stack">
      <h2 id="latest-h">Latest News</h2>
      ${posts.length ? posts.map(postCard).join('') : '<p class="muted">Nothing posted yet. Check back soon.</p>'}
      ${posts.length ? `<p><a class="text-link" href="#/a/${esc(biz.slug)}/news">All News</a></p>` : ''}
    </section>`
}

function viewNews(): string {
  const posts = sortedPosts()
  return `<h1>News</h1>${
    posts.length ? posts.map(postCard).join('') : '<p class="muted">Nothing posted yet. Check back soon.</p>'
  }`
}

function viewEvents(): string {
  const list = upcoming()
  return `<h1>Events</h1>${
    list.length
      ? list
          .map(
            (e) => `<article class="capp-post">
              <p class="date-chip">${fmtDay(e.date)}</p>
              <h3>${esc(e.title)}</h3>
              <p class="meta">${fmtDate(e.date)}${e.location ? `, ${esc(e.location)}` : ''}</p>
              ${e.description ? `<div class="prose">${paragraphs(e.description)}</div>` : ''}
            </article>`,
          )
          .join('')
      : '<p class="muted">No upcoming events right now.</p>'
  }`
}

function viewAlerts(
  biz: Business,
  viewer: Viewer,
  sent: { id: string; title: string; body: string; sentAt: string }[],
  fresh: Set<string>,
): string {
  return `<h1>Alerts</h1>
    ${viewer.subscribed ? '' : subscribeBlock(biz, viewer)}
    ${
      sent.length
        ? sent
            .map(
              (n) => `<article class="capp-post">
                <h3>${esc(n.title)} ${fresh.has(n.id) ? '<span class="tag tag-ok">New</span>' : ''}</h3>
                <p class="meta">${fmtDate(n.sentAt)}</p>
                <p>${esc(n.body)}</p>
              </article>`,
            )
            .join('')
        : '<p class="muted">No notifications yet.</p>'
    }`
}

function viewContact(biz: Business, formId: string | null): string {
  const s = cur
  const form = formId ? s.forms.find((f) => f.id === formId) : undefined
  if (form) return viewForm(biz, form.id, form.name, form.fields)

  const digits = (v: string) => v.replace(/[^\d+]/g, '')
  const wa = digits(biz.whatsapp).replace(/^\+/, '').replace(/^0/, '27')
  const rows: string[] = []
  if (biz.phone) rows.push(`<li><a class="btn btn-quiet" href="tel:${esc(digits(biz.phone))}">Call ${esc(biz.phone)}</a></li>`)
  if (biz.whatsapp) rows.push(`<li><a class="btn btn-quiet" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">WhatsApp<span class="sr-only"> (opens in a new tab)</span></a></li>`)
  if (biz.email) rows.push(`<li><a class="btn btn-quiet" href="mailto:${esc(biz.email)}">Email Us</a></li>`)
  const links = s.links
    .map((l) => ({ l, url: safeUrl(l.url) }))
    .filter((x) => x.url)
    .map(
      ({ l, url }) =>
        `<li><a class="btn btn-quiet" href="${esc(url)}" target="_blank" rel="noopener">${esc(l.label)}<span class="sr-only"> (opens in a new tab)</span></a></li>`,
    )

  return `<h1>Contact</h1>
    ${
      s.forms.length
        ? `<section class="stack" aria-labelledby="forms-h">
            <h2 id="forms-h">Send Us a Message</h2>
            <ul class="btn-list">${s.forms
              .map((f) => `<li><a class="btn" href="#/a/${esc(biz.slug)}/contact?form=${encodeURIComponent(f.id)}">${esc(f.name)}</a></li>`)
              .join('')}</ul>
          </section>`
        : ''
    }
    ${rows.length ? `<section class="stack" aria-labelledby="reach-h"><h2 id="reach-h">Reach Us</h2><ul class="btn-list">${rows.join('')}</ul></section>` : ''}
    ${links.length ? `<section class="stack" aria-labelledby="links-h"><h2 id="links-h">Useful Links</h2><ul class="btn-list">${links.join('')}</ul></section>` : ''}
    ${
      biz.address || biz.hours
        ? `<section class="stack" aria-labelledby="find-h"><h2 id="find-h">Find Us</h2>${
            biz.address ? `<p>${esc(biz.address)}</p>` : ''
          }${biz.hours ? `<div class="prose">${paragraphs(biz.hours)}</div>` : ''}</section>`
        : ''
    }
    ${!s.forms.length && !rows.length && !links.length && !biz.address && !biz.hours ? '<p class="muted">Contact details have not been added yet.</p>' : ''}`
}

const autocompleteFor = (f: Field): string =>
  f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : /name/i.test(f.label) ? 'name' : 'off'

function viewForm(biz: Business, id: string, name: string, fields: Field[]): string {
  return `<p><a class="text-link" href="#/a/${esc(biz.slug)}/contact">Back to Contact</a></p>
    <h1>${esc(name)}</h1>
    <form class="stack" data-submit="submitForm" data-form="${esc(id)}" autocomplete="on">
      ${fields
        .map((f) => {
          const fid = `q-${esc(f.id)}`
          const req = f.required ? 'required' : ''
          const control =
            f.type === 'textarea'
              ? `<textarea id="${fid}" name="${fid}" rows="4" maxlength="1000" ${req}></textarea>`
              : `<input id="${fid}" name="${fid}" type="${f.type}" maxlength="200" autocomplete="${autocompleteFor(f)}" ${
                  f.type === 'tel' ? 'inputmode="tel"' : ''
                } ${f.type === 'email' ? 'spellcheck="false"' : ''} ${req}>`
          return `<div class="field"><label for="${fid}">${esc(f.label)}${f.required ? '' : ' <span class="muted">(optional)</span>'}</label>${control}</div>`
        })
        .join('')}
      <div><button class="btn" type="submit">Send</button></div>
    </form>`
}

register({
  subscribe: async (el) => {
    const slug = el.dataset.slug!
    const v = loadViewer(slug)
    try {
      if (cloudEnabled) await subscribeDevice(slug, v.device)
      else mutate((s) => s.subscribers.push({ id: newId(), at: new Date().toISOString() }))
    } catch {
      toast('Could not turn notifications on. Please try again.', 'error')
      return
    }
    v.subscribed = true
    saveViewer(slug, v)
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission()
      }
    } catch {
      // Ignore: in-app alerts still work without browser permission.
    }
    toast('Notifications are on.')
    notify()
  },

  unsubscribe: async (el) => {
    const slug = el.dataset.slug!
    const v = loadViewer(slug)
    try {
      if (cloudEnabled) await unsubscribeDevice(slug, v.device)
      else mutate((s) => s.subscribers.pop())
    } catch {
      toast('Could not turn notifications off. Please try again.', 'error')
      return
    }
    v.subscribed = false
    saveViewer(slug, v)
    toast('Notifications are off.')
    notify()
  },

  retryApp: (el) => void retry(el.dataset.slug!),

  submitForm: async (form) => {
    const f = form as HTMLFormElement
    const def = cur.forms.find((x) => x.id === f.dataset.form)
    if (!def || !cur.business) return
    const d = formData(f)
    const values = def.fields.map((fld) => ({
      label: fld.label,
      value: String(d.get(`q-${fld.id}`) ?? '').trim(),
    }))
    const slug = cur.business.slug
    if (cloudEnabled) {
      try {
        await submitAnswers(slug, def.id, values)
      } catch {
        toast('We could not send that. Please check your connection and try again.', 'error')
        return
      }
    } else {
      mutate((st) =>
        st.submissions.push({
          id: newId(),
          formId: def.id,
          formName: def.name,
          at: new Date().toISOString(),
          values,
          read: false,
        }),
      )
    }
    toast('Thank you. We have your message.')
    go(`/a/${slug}/contact`)
  },
})
