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

// The whole store sits behind get / mutate / subscribe. To move to a real backend
// (for example Supabase, as ASC Manager uses), replace load and save and keep the rest.
const KEY = 'asc-business:v1'

const empty = (): State => ({
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
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...empty(), ...(JSON.parse(raw) as Partial<State>) }
  } catch {
    // Storage blocked or corrupt: start clean.
  }
  return empty()
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

export function mutate(fn: (s: State) => void): void {
  fn(state)
  save()
  emit()
}

export function subscribe(fn: () => void): void {
  listeners.add(fn)
}

export function reset(): void {
  state = empty()
  save()
  emit()
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
window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    state = load()
    emit()
  }
})

export const newId = uid
