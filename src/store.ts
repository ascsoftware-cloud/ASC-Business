import * as cloud from './cloud.ts'
import { cloudEnabled } from './cloud.ts'
import { toast } from './ui.ts'
import { uid } from './util.ts'

export type Industry =
  | 'gym'
  | 'salon'
  | 'restaurant'
  | 'school'
  | 'estate'
  | 'clinic'
  | 'retail'
  | 'other'

export type FieldType = 'text' | 'email' | 'tel' | 'textarea'

export interface Business {
  name: string
  slug: string
  industry: Industry
  tagline: string
  color: string
  phone: string
  whatsapp: string
  email: string
  address: string
  hours: string
}

export interface Post {
  id: string
  title: string
  body: string
  createdAt: string
  pinned: boolean
}

export interface EventItem {
  id: string
  title: string
  date: string
  location: string
  description: string
}

export interface Notice {
  id: string
  title: string
  body: string
  status: 'sent' | 'scheduled'
  sentAt: string
  scheduledFor: string
}

export interface Field {
  id: string
  label: string
  type: FieldType
  required: boolean
}

export interface FormDef {
  id: string
  name: string
  fields: Field[]
}

export interface Submission {
  id: string
  formId: string
  formName: string
  at: string
  values: { label: string; value: string }[]
  read: boolean
}

export interface LinkItem {
  id: string
  label: string
  url: string
}

export interface Subscriber {
  id: string
  at: string
}

export interface State {
  business: Business | null
  posts: Post[]
  events: EventItem[]
  notices: Notice[]
  forms: FormDef[]
  submissions: Submission[]
  links: LinkItem[]
  subscribers: Subscriber[]
}

// The whole store sits behind get / mutate / subscribe. Two ways to keep the data:
//   local  (no Supabase settings): this browser's localStorage.
//   cloud  (Supabase settings present): the owner's account, saved through cloud.ts.
// Everything above the store, the pages and their actions, is the same in both.
const KEY = 'asc-business:v1'

export const emptyState = (): State => ({
  business: null,
  posts: [],
  events: [],
  notices: [],
  forms: [],
  submissions: [],
  links: [],
  subscribers: [],
})

function load(): State {
  if (cloudEnabled) return emptyState()
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...emptyState(), ...(JSON.parse(raw) as Partial<State>) }
  } catch {
    // Storage blocked or corrupt: start clean.
  }
  return emptyState()
}

let state: State = load()
const listeners = new Set<() => void>()

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Private mode or quota: the session still works, it just won't persist.
  }
}

const emit = (): void => listeners.forEach((fn) => fn())

export const get = (): State => state

/** Tell the page something outside the owner's own data changed (for example a customer's view). */
export const notify = emit

export function mutate(fn: (s: State) => void): void {
  if (!cloudEnabled) {
    fn(state)
    save()
    emit()
    return
  }
  const before = new Map(state.submissions.map((x) => [x.id, x.read]))
  fn(state)
  syncInbox(before)
  schedule(state.business && !remote ? 0 : SAVE_DELAY)
  emit()
}

export function subscribe(fn: () => void): void {
  listeners.add(fn)
}

/** Delete the business. In cloud mode this removes it for customers too, so it can fail. */
export async function reset(): Promise<boolean> {
  if (cloudEnabled) {
    try {
      clearTimeout(timer)
      await chain
      await cloud.deleteApp()
    } catch {
      toast('Could not delete your app. Check your connection and try again.', 'error')
      return false
    }
    remote = false
    lastSaved = ''
  }
  state = emptyState()
  if (!cloudEnabled) save()
  emit()
  return true
}

/** Move scheduled notifications whose time has come into the sent list. */
export function releaseScheduled(): void {
  const now = Date.now()
  const due = state.notices.filter(
    (n) => n.status === 'scheduled' && new Date(n.scheduledFor).getTime() <= now,
  )
  if (!due.length) return
  mutate((s) => {
    for (const n of s.notices) {
      if (n.status === 'scheduled' && new Date(n.scheduledFor).getTime() <= now) {
        n.status = 'sent'
        n.sentAt = n.scheduledFor
      }
    }
  })
}

// Other tabs and the live preview iframe share this storage, so keep them in step.
if (!cloudEnabled) {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load()
      emit()
    }
  })
}

export const newId = uid

/* ---------- Cloud ---------- */

const SAVE_DELAY = 600

let ownerId: string | null = null
let accountFailed = false
let remote = false // does the owner's app exist in the cloud yet
let lastSaved = '' // what the cloud holds, to skip saves that change nothing
let timer: number | undefined
let chain: Promise<unknown> = Promise.resolve()
let failing = false
let inboxBusy = 0

/** Local mode has no sign-in, so it is always "signed in". */
export const isSignedIn = (): boolean => !cloudEnabled || ownerId !== null
export const accountLoadFailed = (): boolean => accountFailed

const contentOf = (s: State): cloud.Content => ({
  business: s.business,
  posts: s.posts,
  events: s.events,
  notices: s.notices,
  forms: s.forms,
  links: s.links,
})

/**
 * Load the account that just signed in (or clear everything on sign-out).
 * Calls queue up, and asking for the account already loaded does nothing.
 */
export function syncAccount(userId: string | null): Promise<void> {
  const run = async (): Promise<void> => {
    if (userId === ownerId && !accountFailed) return
    clearTimeout(timer)
    try {
      const owned = userId ? await cloud.fetchOwner() : null
      state = owned
        ? { ...emptyState(), ...owned.content, submissions: owned.submissions, subscribers: owned.subscribers }
        : emptyState()
      remote = owned !== null
      lastSaved = owned ? JSON.stringify(contentOf(state)) : ''
      accountFailed = false
    } catch {
      state = emptyState()
      remote = false
      lastSaved = ''
      accountFailed = true
      toast('Could not load your account. Check your connection.', 'error')
    }
    ownerId = userId
    emit()
  }
  const next = chain.then(run, run) as Promise<void>
  chain = next
  return next
}

export const retryAccount = (): Promise<void> => {
  accountFailed = true // forces a reload even though the user id has not changed
  return syncAccount(ownerId)
}

function schedule(delay: number): void {
  clearTimeout(timer)
  timer = window.setTimeout(() => void persist(), delay)
}

/** Save now and report whether the cloud has the latest. Setup awaits this before moving on. */
export function flush(): Promise<boolean> {
  clearTimeout(timer)
  return persist()
}

const persist = (): Promise<boolean> => {
  const next = chain.then(saveOnce, saveOnce) as Promise<boolean>
  chain = next
  return next
}

async function saveOnce(): Promise<boolean> {
  if (!cloudEnabled || !state.business || ownerId === null) return true
  const snapshot = JSON.stringify(contentOf(state))
  if (snapshot === lastSaved) return true
  try {
    let saved = snapshot
    if (remote) {
      await cloud.saveContent(JSON.parse(snapshot))
    } else {
      const slug = await cloud.createApp(JSON.parse(snapshot))
      remote = true
      if (state.business && slug !== state.business.slug) {
        // Another business already had this address, so the cloud gave us a free one.
        state.business.slug = slug
        const fixed = JSON.parse(snapshot) as cloud.Content
        fixed.business!.slug = slug
        saved = JSON.stringify(fixed)
        emit()
      }
    }
    lastSaved = saved
    if (failing) toast('Changes saved.')
    failing = false
    return true
  } catch {
    if (!failing) toast('Could not save your changes. Retrying…', 'error')
    failing = true
    schedule(8000)
    return false
  }
}

/** Push enquiry changes (marked read, deleted) made in this edit. */
function syncInbox(before: Map<string, boolean>): void {
  const now = new Map(state.submissions.map((x) => [x.id, x.read]))
  const gone = [...before.keys()].filter((id) => !now.has(id))
  const read = [...now].filter(([id, isRead]) => isRead && before.get(id) === false).map(([id]) => id)
  const run = (job: Promise<void>): void => {
    inboxBusy++
    job
      .catch(() => toast('Could not update your enquiries. Check your connection.', 'error'))
      .finally(() => inboxBusy--)
  }
  if (gone.length) run(cloud.deleteSubmissions(gone))
  if (read.length) run(cloud.markRead(read))
}

/** Pick up enquiries and subscribers that customers have added since the last look. */
export async function refreshInbox(): Promise<void> {
  if (!cloudEnabled || !remote || inboxBusy) return
  try {
    const inbox = await cloud.fetchInbox()
    if (!inbox || inboxBusy) return
    const same = JSON.stringify(inbox) === JSON.stringify({ submissions: state.submissions, subscribers: state.subscribers })
    if (same) return
    state.submissions = inbox.submissions
    state.subscribers = inbox.subscribers
    emit()
  } catch {
    // Offline for a moment: the next look will catch up.
  }
}
