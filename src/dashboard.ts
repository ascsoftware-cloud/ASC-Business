import { get, mutate, reset } from './store.ts'
import type { Industry } from './store.ts'
import { go } from './router.ts'
import { industryList } from './templates.ts'
import { formData, register, str, toast } from './ui.ts'
import { esc, fmtDate, isHex, plural } from './util.ts'
import { pageEvents, pageForms, pageLinks, pageNews, pageNotices } from './manage.ts'
import { site } from './content.ts'

export const appUrl = (slug: string): string => `${location.origin}${location.pathname}#/a/${slug}`

const nav: { path: string; label: string }[] = [
  { path: '', label: 'Overview' },
  { path: 'notifications', label: 'Notifications' },
  { path: 'news', label: 'News' },
  { path: 'events', label: 'Events' },
  { path: 'forms', label: 'Forms & Enquiries' },
  { path: 'links', label: 'Links' },
  { path: 'preview', label: 'Preview' },
  { path: 'settings', label: 'Settings' },
]

export function renderDashboard(sub: string[], params: URLSearchParams): string {
  const s = get()
  const biz = s.business!
  const page = sub[0] ?? ''
  const unread = s.submissions.filter((x) => !x.read).length

  let body: string
  switch (page) {
    case '':
      body = pageOverview(params.has('welcome'))
      break
    case 'notifications':
      body = pageNotices()
      break
    case 'news':
      body = pageNews(params)
      break
    case 'events':
      body = pageEvents(params)
      break
    case 'forms':
      body = pageForms(params)
      break
    case 'links':
      body = pageLinks()
      break
    case 'preview':
      body = pagePreview()
      break
    case 'settings':
      body = pageSettings()
      break
    default:
      body = `<header class="page-head"><h1>Page Not Found</h1></header><p><a href="#/dashboard">Back to the overview</a></p>`
  }

  return `
    <button class="skip" type="button" data-action="skip">Skip to Main Content</button>
    <div class="dash">
      <aside class="side">
        <a class="side-brand" href="#/dashboard"><span translate="no">${esc(biz.name)}</span></a>
        <nav aria-label="Dashboard">
          <ul class="side-nav">
            ${nav
              .map(
                (n) => `<li><a href="#/dashboard${n.path ? `/${n.path}` : ''}" ${
                  n.path === page ? 'aria-current="page"' : ''
                }>${n.label}${n.path === 'forms' && unread ? ` <span class="badge" aria-label="${plural(unread, 'new enquiry', 'new enquiries')}">${unread}</span>` : ''}</a></li>`,
              )
              .join('')}
          </ul>
        </nav>
        <ul class="side-foot">
          <li><a href="#/a/${esc(biz.slug)}" target="_blank" rel="noopener">Open Your App<span class="sr-only"> (opens in a new tab)</span></a></li>
          <li><a href="#/">Back to Site</a></li>
        </ul>
      </aside>
      <main class="dash-main" id="main" tabindex="-1">${body}</main>
    </div>`
}

function pageOverview(welcome: boolean): string {
  const s = get()
  const biz = s.business!
  const upcoming = s.events.filter((e) => +new Date(e.date) >= Date.now()).length
  const unread = s.submissions.filter((x) => !x.read).length
  const recent = [...s.submissions].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 4)
  const link = appUrl(biz.slug)
  return `
    <header class="page-head">
      <h1>${welcome ? 'Your App Is Ready' : 'Overview'}</h1>
      <p>${
        welcome
          ? 'We added sample news, an event and a form so you can see how it works. Edit or delete anything.'
          : `What’s happening in ${esc(biz.name)}’s app.`
      }</p>
    </header>

    <dl class="stats">
      <div><dt>Subscribers</dt><dd>${s.subscribers.length}</dd></div>
      <div><dt>Posts</dt><dd>${s.posts.length}</dd></div>
      <div><dt>Upcoming events</dt><dd>${upcoming}</dd></div>
      <div><dt>New enquiries</dt><dd>${unread}</dd></div>
    </dl>

    <section class="panel stack" aria-labelledby="share-h">
      <h2 id="share-h" class="h-small">Share Your App</h2>
      <p>Send this link to customers, or put it on receipts and posters. They open it on their phone and add it to the home screen.</p>
      <div class="copy-row">
        <label class="sr-only" for="app-link">Your app link</label>
        <input id="app-link" readonly value="${esc(link)}" spellcheck="false">
        <button class="btn btn-quiet" type="button" data-action="copy" data-target="app-link">Copy Link</button>
      </div>
    </section>

    <section class="stack" aria-labelledby="quick-h">
      <h2 id="quick-h" class="h-small">Quick Actions</h2>
      <div class="row-actions">
        <a class="btn" href="#/dashboard/notifications">Send a Notification</a>
        <a class="btn btn-quiet" href="#/dashboard/news?new=1">Post News</a>
        <a class="btn btn-quiet" href="#/dashboard/events?new=1">Add an Event</a>
      </div>
    </section>

    <section class="stack" aria-labelledby="recent-h">
      <h2 id="recent-h" class="h-small">Latest Enquiries</h2>
      ${
        recent.length
          ? `<ul class="rows">${recent
              .map(
                (x) => `<li class="row"><div><h3>${esc(x.formName)}${x.read ? '' : ' <span class="tag tag-ok">New</span>'}</h3><p class="meta">${fmtDate(x.at)}</p><p class="clamp">${esc(x.values.map((v) => v.value).filter(Boolean).join(', '))}</p></div><a class="btn btn-quiet btn-small" href="#/dashboard/forms">Open</a></li>`,
              )
              .join('')}</ul>`
          : `<div class="empty"><p>No enquiries yet. Open your app and submit a form to see one arrive.</p></div>`
      }
    </section>`
}

function pagePreview(): string {
  const biz = get().business!
  return `
    <header class="page-head">
      <h1>Preview</h1>
      <p>This is your customers’ app. It updates as you make changes.</p>
    </header>
    <div class="preview">
      <div class="phone">
        <iframe title="Live preview of ${esc(biz.name)}’s app" src="${esc(location.pathname)}#/a/${esc(biz.slug)}"></iframe>
      </div>
      <div class="stack">
        <p>Try it: subscribe to notifications in the preview, then send one from the Notifications page.</p>
        <p><a class="btn btn-quiet" href="#/a/${esc(biz.slug)}" target="_blank" rel="noopener">Open in a New Tab<span class="sr-only"> (opens in a new tab)</span></a></p>
      </div>
    </div>`
}

function pageSettings(): string {
  const b = get().business!
  const input = (id: string, label: string, value: string, extra = '') =>
    `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" value="${esc(value)}" ${extra}></div>`
  return `
    <header class="page-head">
      <h1>Settings</h1>
      <p>Your business details and how your app looks.</p>
    </header>
    <form class="panel stack" data-submit="saveSettings" autocomplete="off">
      ${input('name', 'Business name', b.name, 'required maxlength="60"')}
      ${input('tagline', 'Tagline', b.tagline, 'maxlength="80"')}
      <div class="field">
        <label for="industry">Business type</label>
        <select id="industry" name="industry">
          ${industryList.map((i) => `<option value="${i.key}" ${i.key === b.industry ? 'selected' : ''}>${i.label}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="color">Brand colour</label>
        <input id="color" name="color" type="color" value="${esc(b.color)}" class="color-input">
      </div>
      <h2 class="h-small">Contact Details</h2>
      ${input('phone', 'Phone', b.phone, 'type="tel" inputmode="tel"')}
      ${input('whatsapp', 'WhatsApp number', b.whatsapp, 'type="tel" inputmode="tel"')}
      ${input('email', 'Email', b.email, 'type="email" spellcheck="false"')}
      ${input('address', 'Address', b.address)}
      <div class="field">
        <label for="hours">Opening hours</label>
        <textarea id="hours" name="hours" rows="3">${esc(b.hours)}</textarea>
      </div>
      <div><button class="btn" type="submit">Save Settings</button></div>
    </form>

    <section class="panel stack danger-zone" aria-labelledby="danger-h">
      <h2 id="danger-h" class="h-small">Start Over</h2>
      <p>Delete this business and all its posts, events, forms and enquiries from this browser.</p>
      <div><button class="btn btn-danger" type="button" data-action="resetAll">Delete Everything</button></div>
    </section>
    <p class="muted small">Data is saved in this browser for now. ${esc(site.brand)} accounts and cloud sync come with the hosted version.</p>`
}

register({
  skip: () => document.getElementById('main')?.focus(),

  copy: async (el) => {
    const input = document.getElementById(el.dataset.target ?? '') as HTMLInputElement | null
    if (!input) return
    try {
      await navigator.clipboard.writeText(input.value)
      toast('Link copied.')
    } catch {
      input.select()
      toast('Press Ctrl+C to copy the selected link.')
    }
  },

  saveSettings: (form) => {
    const d = formData(form as HTMLFormElement)
    const color = str(d, 'color')
    mutate((s) => {
      Object.assign(s.business!, {
        name: str(d, 'name') || s.business!.name,
        tagline: str(d, 'tagline'),
        industry: str(d, 'industry') as Industry,
        color: isHex(color) ? color : s.business!.color,
        phone: str(d, 'phone'),
        whatsapp: str(d, 'whatsapp'),
        email: str(d, 'email'),
        address: str(d, 'address'),
        hours: str(d, 'hours'),
      })
    })
    toast('Settings saved.')
  },

  resetAll: () => {
    if (!window.confirm('Delete your business and all its content from this browser? This cannot be undone.')) return
    reset()
    go('/start')
  },
})
