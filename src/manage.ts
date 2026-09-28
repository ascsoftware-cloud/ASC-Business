import { get, mutate, newId } from './store.ts'
import type { Field, FieldType, Notice } from './store.ts'
import { go } from './router.ts'
import { formData, register, str, toast } from './ui.ts'
import {
  esc,
  fmtDate,
  fromLocalInput,
  plural,
  safeUrl,
  toLocalInput,
} from './util.ts'

const base = '/dashboard'

const empty = (text: string, action = ''): string =>
  `<div class="empty"><p>${esc(text)}</p>${action}</div>`

const actionsFor = (kind: string, id: string, title: string, editHref: string): string => `
  <div class="row-actions">
    ${editHref ? `<a class="btn btn-quiet btn-small" href="${editHref}">Edit<span class="sr-only"> ${esc(title)}</span></a>` : ''}
    <button class="btn btn-danger btn-small" type="button" data-action="delete" data-kind="${kind}" data-id="${esc(id)}" aria-label="Delete ${esc(title)}">Delete</button>
  </div>`

/* ---------- Notifications ---------- */

export function pageNotices(): string {
  const s = get()
  const soon = toLocalInput(new Date(Date.now() + 3_600_000))
  const notices = [...s.notices].sort(
    (a, b) => +new Date(b.sentAt || b.scheduledFor) - +new Date(a.sentAt || a.scheduledFor),
  )
  return `
    <header class="page-head">
      <h1>Notifications</h1>
      <p>Short messages that appear in your customers’ app. They reach ${plural(s.subscribers.length, 'subscriber')} right now.</p>
    </header>

    <form class="panel stack" data-submit="sendNotice" autocomplete="off">
      <h2 class="h-small">Write a Notification</h2>
      <div class="field">
        <label for="n-title">Title</label>
        <input id="n-title" name="title" required maxlength="50" placeholder="Friday special: 2 for 1 cappuccinos…">
      </div>
      <div class="field">
        <label for="n-body">Message</label>
        <textarea id="n-body" name="body" required maxlength="140" rows="3" placeholder="Show this message at the till before 15:00…"></textarea>
        <p class="hint">Up to 140 characters. Short messages get read.</p>
      </div>
      <fieldset class="field">
        <legend>When to send</legend>
        <label class="choice"><input type="radio" name="when" value="now" checked> Send now</label>
        <label class="choice"><input type="radio" name="when" value="later"> Schedule for later</label>
        <label class="sub-label" for="n-time">Schedule time</label>
        <input id="n-time" type="datetime-local" name="time" value="${soon}" min="${toLocalInput(new Date())}">
      </fieldset>
      <div><button class="btn" type="submit">Send Notification</button></div>
    </form>

    <section class="stack" aria-labelledby="hist-h">
      <h2 id="hist-h" class="h-small">History</h2>
      ${
        notices.length
          ? `<ul class="rows">${notices
              .map(
                (n) => `<li class="row">
                  <div>
                    <h3>${esc(n.title)}</h3>
                    <p>${esc(n.body)}</p>
                    <p class="meta">${
                      n.status === 'sent'
                        ? `<span class="tag tag-ok">Sent</span> ${fmtDate(n.sentAt)}`
                        : `<span class="tag">Scheduled</span> ${fmtDate(n.scheduledFor)}`
                    }</p>
                  </div>
                  ${actionsFor('notice', n.id, n.title, '')}
                </li>`,
              )
              .join('')}</ul>`
          : empty('Nothing sent yet. Your first notification will show here.')
      }
    </section>`
}

/* ---------- News ---------- */

export function pageNews(params: URLSearchParams): string {
  const s = get()
  if (params.has('new') || params.has('edit')) {
    const post = s.posts.find((p) => p.id === params.get('edit'))
    return `
      <header class="page-head"><h1>${post ? 'Edit Post' : 'New Post'}</h1></header>
      <form class="panel stack" data-submit="savePost" autocomplete="off">
        <input type="hidden" name="id" value="${esc(post?.id ?? '')}">
        <div class="field">
          <label for="p-title">Title</label>
          <input id="p-title" name="title" required maxlength="90" value="${esc(post?.title ?? '')}">
        </div>
        <div class="field">
          <label for="p-body">Post</label>
          <textarea id="p-body" name="body" required rows="7" maxlength="2000">${esc(post?.body ?? '')}</textarea>
          <p class="hint">Leave a blank line between paragraphs.</p>
        </div>
        <label class="choice"><input type="checkbox" name="pinned" ${post?.pinned ? 'checked' : ''}> Pin to the top of the app</label>
        <div class="row-actions">
          <button class="btn" type="submit">${post ? 'Save Changes' : 'Publish Post'}</button>
          <a class="btn btn-quiet" href="#${base}/news">Cancel</a>
        </div>
      </form>`
  }
  const posts = [...s.posts].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.createdAt) - +new Date(a.createdAt),
  )
  return `
    <header class="page-head with-action">
      <div><h1>News</h1><p>Updates and promotions customers see on the Home and News tabs.</p></div>
      <a class="btn" href="#${base}/news?new=1">New Post</a>
    </header>
    ${
      posts.length
        ? `<ul class="rows">${posts
            .map(
              (p) => `<li class="row">
                <div>
                  <h3>${esc(p.title)}${p.pinned ? ' <span class="tag">Pinned</span>' : ''}</h3>
                  <p class="clamp">${esc(p.body)}</p>
                  <p class="meta">${fmtDate(p.createdAt)}</p>
                </div>
                ${actionsFor('post', p.id, p.title, `#${base}/news?edit=${encodeURIComponent(p.id)}`)}
              </li>`,
            )
            .join('')}</ul>`
        : empty('No posts yet. Share your first update.', `<a class="btn" href="#${base}/news?new=1">New Post</a>`)
    }`
}

/* ---------- Events ---------- */

export function pageEvents(params: URLSearchParams): string {
  const s = get()
  if (params.has('new') || params.has('edit')) {
    const ev = s.events.find((e) => e.id === params.get('edit'))
    const when = toLocalInput(ev ? new Date(ev.date) : new Date(Date.now() + 7 * 86_400_000))
    return `
      <header class="page-head"><h1>${ev ? 'Edit Event' : 'New Event'}</h1></header>
      <form class="panel stack" data-submit="saveEvent" autocomplete="off">
        <input type="hidden" name="id" value="${esc(ev?.id ?? '')}">
        <div class="field">
          <label for="e-title">Event name</label>
          <input id="e-title" name="title" required maxlength="90" value="${esc(ev?.title ?? '')}">
        </div>
        <div class="field">
          <label for="e-date">Date and time</label>
          <input id="e-date" type="datetime-local" name="date" required value="${when}">
        </div>
        <div class="field">
          <label for="e-loc">Location</label>
          <input id="e-loc" name="location" maxlength="120" value="${esc(ev?.location ?? '')}">
        </div>
        <div class="field">
          <label for="e-desc">Details</label>
          <textarea id="e-desc" name="description" rows="4" maxlength="800">${esc(ev?.description ?? '')}</textarea>
        </div>
        <div class="row-actions">
          <button class="btn" type="submit">${ev ? 'Save Changes' : 'Add Event'}</button>
          <a class="btn btn-quiet" href="#${base}/events">Cancel</a>
        </div>
      </form>`
  }
  const now = Date.now()
  const events = [...s.events].sort((a, b) => +new Date(a.date) - +new Date(b.date))
  return `
    <header class="page-head with-action">
      <div><h1>Events</h1><p>Launches, classes, open days and changes to trading hours.</p></div>
      <a class="btn" href="#${base}/events?new=1">New Event</a>
    </header>
    ${
      events.length
        ? `<ul class="rows">${events
            .map(
              (e) => `<li class="row">
                <div>
                  <h3>${esc(e.title)}${+new Date(e.date) < now ? ' <span class="tag">Past</span>' : ''}</h3>
                  <p class="meta">${fmtDate(e.date)}${e.location ? `, ${esc(e.location)}` : ''}</p>
                  ${e.description ? `<p class="clamp">${esc(e.description)}</p>` : ''}
                </div>
                ${actionsFor('event', e.id, e.title, `#${base}/events?edit=${encodeURIComponent(e.id)}`)}
              </li>`,
            )
            .join('')}</ul>`
        : empty('No events yet.', `<a class="btn" href="#${base}/events?new=1">New Event</a>`)
    }`
}

/* ---------- Forms and enquiries ---------- */

const fieldTypes: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone number' },
]

export function pageForms(params: URLSearchParams): string {
  const s = get()
  if (params.has('new') || params.has('form')) {
    const form = s.forms.find((f) => f.id === params.get('form'))
    const fields = form?.fields ?? []
    return `
      <header class="page-head"><h1>${form ? 'Edit Form' : 'New Form'}</h1></header>
      <form class="panel stack" data-submit="saveForm" autocomplete="off">
        <input type="hidden" name="id" value="${esc(form?.id ?? '')}">
        <button class="sr-only" type="submit" name="intent" value="save" tabindex="-1" aria-hidden="true">Save Form</button>
        <div class="field">
          <label for="f-name">Form name</label>
          <input id="f-name" name="name" required maxlength="60" value="${esc(form?.name ?? '')}" placeholder="Book a Table…">
        </div>
        <h2 class="h-small">Questions</h2>
        ${fields
          .map(
            (f, i) => `
          <div class="field-row">
            <input type="hidden" name="fid" value="${esc(f.id)}">
            <div class="field">
              <label for="fl-${i}">Question ${i + 1}</label>
              <input id="fl-${i}" name="flabel" required maxlength="80" value="${esc(f.label)}">
            </div>
            <div class="field">
              <label for="ft-${i}">Answer type</label>
              <select id="ft-${i}" name="ftype">
                ${fieldTypes.map((t) => `<option value="${t.value}" ${t.value === f.type ? 'selected' : ''}>${t.label}</option>`).join('')}
              </select>
            </div>
            <label class="choice"><input type="checkbox" name="freq" value="${esc(f.id)}" ${f.required ? 'checked' : ''}> Required</label>
            <button class="btn btn-danger btn-small" type="submit" name="intent" value="remove:${i}" formnovalidate aria-label="Remove question ${i + 1}">Remove</button>
          </div>`,
          )
          .join('')}
        <div><button class="btn btn-quiet" type="submit" name="intent" value="add" formnovalidate>Add Question</button></div>
        <div class="row-actions">
          <button class="btn" type="submit" name="intent" value="save">Save Form</button>
          <a class="btn btn-quiet" href="#${base}/forms">Cancel</a>
        </div>
      </form>`
  }

  const inbox = [...s.submissions].sort((a, b) => +new Date(b.at) - +new Date(a.at))
  return `
    <header class="page-head with-action">
      <div><h1>Forms & Enquiries</h1><p>Forms customers fill in from your app, and the answers they send back.</p></div>
      <a class="btn" href="#${base}/forms?new=1">New Form</a>
    </header>

    <section class="stack" aria-labelledby="inbox-h">
      <h2 id="inbox-h" class="h-small">Enquiries</h2>
      ${
        inbox.length
          ? `<ul class="rows">${inbox
              .map(
                (x) => `<li class="row ${x.read ? '' : 'row-unread'}">
                  <div>
                    <h3>${esc(x.formName)} ${x.read ? '' : '<span class="tag tag-ok">New</span>'}</h3>
                    <p class="meta">${fmtDate(x.at)}</p>
                    <dl class="answers">
                      ${x.values.map((v) => `<div><dt>${esc(v.label)}</dt><dd>${esc(v.value) || '<span class="muted">Not answered</span>'}</dd></div>`).join('')}
                    </dl>
                  </div>
                  <div class="row-actions">
                    ${x.read ? '' : `<button class="btn btn-quiet btn-small" type="button" data-action="markRead" data-id="${esc(x.id)}">Mark as Read</button>`}
                    <button class="btn btn-danger btn-small" type="button" data-action="delete" data-kind="submission" data-id="${esc(x.id)}" aria-label="Delete enquiry from ${esc(fmtDate(x.at))}">Delete</button>
                  </div>
                </li>`,
              )
              .join('')}</ul>`
          : empty('No enquiries yet. They appear here when a customer submits a form.')
      }
    </section>

    <section class="stack" aria-labelledby="forms-h">
      <h2 id="forms-h" class="h-small">Your Forms</h2>
      ${
        s.forms.length
          ? `<ul class="rows">${s.forms
              .map(
                (f) => `<li class="row">
                  <div><h3>${esc(f.name)}</h3><p class="meta">${plural(f.fields.length, 'question')}</p></div>
                  ${actionsFor('form', f.id, f.name, `#${base}/forms?form=${encodeURIComponent(f.id)}`)}
                </li>`,
              )
              .join('')}</ul>`
          : empty('No forms yet.', `<a class="btn" href="#${base}/forms?new=1">New Form</a>`)
      }
    </section>`
}

/* ---------- Links ---------- */

export function pageLinks(): string {
  const s = get()
  return `
    <header class="page-head">
      <h1>Links</h1>
      <p>Send customers to your online shop, booking system, menu or WhatsApp chat from inside the app.</p>
    </header>
    <form class="panel stack" data-submit="saveLink" autocomplete="off">
      <h2 class="h-small">Add a Link</h2>
      <div class="field-row">
        <div class="field">
          <label for="l-label">Label</label>
          <input id="l-label" name="label" required maxlength="40" placeholder="Book online…">
        </div>
        <div class="field">
          <label for="l-url">Web address</label>
          <input id="l-url" name="url" required type="text" inputmode="url" spellcheck="false" placeholder="https://yourbusiness.co.za…">
        </div>
        <div><button class="btn" type="submit">Add Link</button></div>
      </div>
    </form>
    ${
      s.links.length
        ? `<ul class="rows">${s.links
            .map(
              (l) => `<li class="row">
                <div><h3>${esc(l.label)}</h3><p class="meta break">${esc(l.url)}</p></div>
                ${actionsFor('link', l.id, l.label, '')}
              </li>`,
            )
            .join('')}</ul>`
        : empty('No links yet.')
    }`
}

/* ---------- Actions ---------- */

register({
  sendNotice: (form) => {
    const d = formData(form as HTMLFormElement)
    const title = str(d, 'title')
    const body = str(d, 'body')
    const later = str(d, 'when') === 'later'
    let scheduledFor = ''
    if (later) {
      const t = str(d, 'time')
      if (!t || new Date(t).getTime() <= Date.now()) {
        toast('Choose a time in the future, or pick Send now.', 'error')
        return
      }
      scheduledFor = fromLocalInput(t)
    }
    const notice: Notice = {
      id: newId(),
      title,
      body,
      status: later ? 'scheduled' : 'sent',
      sentAt: later ? '' : new Date().toISOString(),
      scheduledFor,
    }
    mutate((s) => s.notices.push(notice))
    toast(later ? 'Notification scheduled.' : 'Notification sent.')
    go(`${base}/notifications`)
  },

  savePost: (form) => {
    const d = formData(form as HTMLFormElement)
    const id = str(d, 'id')
    mutate((s) => {
      const existing = s.posts.find((p) => p.id === id)
      const values = { title: str(d, 'title'), body: str(d, 'body'), pinned: d.has('pinned') }
      if (existing) Object.assign(existing, values)
      else s.posts.push({ id: newId(), createdAt: new Date().toISOString(), ...values })
    })
    toast(id ? 'Post updated.' : 'Post published.')
    go(`${base}/news`)
  },

  saveEvent: (form) => {
    const d = formData(form as HTMLFormElement)
    const id = str(d, 'id')
    mutate((s) => {
      const existing = s.events.find((e) => e.id === id)
      const values = {
        title: str(d, 'title'),
        date: fromLocalInput(str(d, 'date')),
        location: str(d, 'location'),
        description: str(d, 'description'),
      }
      if (existing) Object.assign(existing, values)
      else s.events.push({ id: newId(), ...values })
    })
    toast(id ? 'Event updated.' : 'Event added.')
    go(`${base}/events`)
  },

  saveForm: (form, ev) => {
    const f = form as HTMLFormElement
    const d = formData(f)
    const intent = (ev as SubmitEvent).submitter?.getAttribute('value') ?? 'save'
    const ids = d.getAll('fid').map(String)
    const labels = d.getAll('flabel').map((v) => String(v).trim())
    const types = d.getAll('ftype').map(String)
    const required = new Set(d.getAll('freq').map(String))
    let fields: Field[] = ids.map((id, i) => ({
      id,
      label: labels[i] || `Question ${i + 1}`,
      type: (types[i] as FieldType) || 'text',
      required: required.has(id),
    }))
    if (intent === 'add') fields.push({ id: newId(), label: '', type: 'text', required: false })
    if (intent.startsWith('remove:')) {
      const at = Number(intent.slice(7))
      fields = fields.filter((_, i) => i !== at)
    }

    let id = str(d, 'id')
    const name = str(d, 'name') || 'Untitled form'
    mutate((s) => {
      const existing = s.forms.find((x) => x.id === id)
      if (existing) {
        existing.name = name
        existing.fields = fields
      } else {
        id = newId()
        s.forms.push({ id, name, fields })
      }
    })

    if (intent === 'save') {
      if (!fields.length) {
        toast('Add at least one question before saving.', 'error')
        go(`${base}/forms?form=${encodeURIComponent(id)}`)
        return
      }
      toast('Form saved.')
      go(`${base}/forms`)
    } else {
      // mutate() already redrew the builder; this moves a brand-new form onto its own address.
      go(`${base}/forms?form=${encodeURIComponent(id)}`)
    }
  },

  saveLink: (form) => {
    const d = formData(form as HTMLFormElement)
    const url = safeUrl(str(d, 'url'))
    if (!url) {
      toast('Enter a web address such as yourbusiness.co.za.', 'error')
      return
    }
    mutate((s) => s.links.push({ id: newId(), label: str(d, 'label'), url }))
    ;(form as HTMLFormElement).reset()
    toast('Link added.')
  },

  markRead: (el) => {
    mutate((s) => {
      const x = s.submissions.find((v) => v.id === el.dataset.id)
      if (x) x.read = true
    })
  },

  delete: (el) => {
    const { kind, id } = el.dataset
    const labels: Record<string, string> = {
      notice: 'notification',
      post: 'post',
      event: 'event',
      form: 'form (its enquiries stay in your inbox)',
      submission: 'enquiry',
      link: 'link',
    }
    if (!kind || !window.confirm(`Delete this ${labels[kind] ?? 'item'}? This cannot be undone.`)) return
    mutate((s) => {
      const drop = <T extends { id: string }>(list: T[]): T[] => list.filter((x) => x.id !== id)
      if (kind === 'notice') s.notices = drop(s.notices)
      if (kind === 'post') s.posts = drop(s.posts)
      if (kind === 'event') s.events = drop(s.events)
      if (kind === 'form') s.forms = drop(s.forms)
      if (kind === 'submission') s.submissions = drop(s.submissions)
      if (kind === 'link') s.links = drop(s.links)
    })
    toast('Deleted.')
  },
})
