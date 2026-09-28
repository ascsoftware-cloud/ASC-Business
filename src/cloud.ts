import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { State, Submission, Subscriber } from './store.ts'

// Everything that talks to Supabase lives here and nothing else does. When the two settings
// below are missing the app runs on browser storage alone (see store.ts), so it still works
// with no backend set up.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudEnabled = Boolean(url && key)

/** What the owner edits. Enquiries and subscribers live in their own tables. */
export type Content = Pick<State, 'business' | 'posts' | 'events' | 'notices' | 'forms' | 'links'>

export interface Inbox {
  submissions: Submission[]
  subscribers: Subscriber[]
}

export interface OwnerData extends Inbox {
  content: Partial<Content>
}

const client: SupabaseClient | null = cloudEnabled
  ? createClient(url!, key!, {
      // PKCE keeps sign-in links out of the URL hash, which the router uses.
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

function sb(): SupabaseClient {
  if (!client) throw new Error('Cloud storage is not configured.')
  return client
}

/** Throw when a Supabase call reports an error, otherwise hand back its data. */
function must<R extends { error: { message: string } | null }>(res: R): R extends { data: infer D } ? D : undefined {
  if (res.error) throw new Error(res.error.message)
  return (res as { data?: unknown }).data as never
}

/* ---------- Accounts ---------- */

const redirect = (): string => `${location.origin}${location.pathname}`

export async function currentUserId(): Promise<string | null> {
  const { data } = await sb().auth.getSession()
  return data.session?.user.id ?? null
}

export const watchAuth = (cb: (userId: string | null) => void): void => {
  sb().auth.onAuthStateChange((_event, session) => cb(session?.user.id ?? null))
}

export async function signIn(email: string, password: string): Promise<void> {
  must(await sb().auth.signInWithPassword({ email, password }))
}

/** True when the account is ready at once; false when the person must confirm by email first. */
export async function signUp(email: string, password: string): Promise<boolean> {
  const data = must(await sb().auth.signUp({ email, password, options: { emailRedirectTo: redirect() } }))
  return data.session !== null
}

export async function emailLink(email: string): Promise<void> {
  must(await sb().auth.signInWithOtp({ email, options: { emailRedirectTo: redirect() } }))
}

export async function signOut(): Promise<void> {
  must(await sb().auth.signOut())
}

/* ---------- Owner ---------- */

let appId: string | null = null

interface SubmissionRow {
  id: string
  form_id: string
  form_name: string
  answers: Submission['values']
  read: boolean
  created_at: string
}

async function loadInbox(id: string): Promise<Inbox> {
  const [subs, people] = await Promise.all([
    sb()
      .from('submissions')
      .select('id, form_id, form_name, answers, read, created_at')
      .eq('app_id', id)
      .order('created_at', { ascending: false })
      .limit(500),
    sb().from('subscribers').select('id, created_at').eq('app_id', id).limit(5000),
  ])
  return {
    submissions: (must(subs) as SubmissionRow[]).map((r) => ({
      id: r.id,
      formId: r.form_id,
      formName: r.form_name,
      at: r.created_at,
      values: r.answers,
      read: r.read,
    })),
    subscribers: (must(people) as { id: string; created_at: string }[]).map((r) => ({ id: r.id, at: r.created_at })),
  }
}

/** The signed-in owner's app, or null when they have not made one yet. */
export async function fetchOwner(): Promise<OwnerData | null> {
  const app = must(await sb().from('apps').select('id, data').maybeSingle()) as { id: string; data: Partial<Content> } | null
  if (!app) {
    appId = null
    return null
  }
  appId = app.id
  return { content: app.data ?? {}, ...(await loadInbox(app.id)) }
}

export async function fetchInbox(): Promise<Inbox | null> {
  return appId ? loadInbox(appId) : null
}

const newSuffix = (): string => Math.random().toString(36).slice(2, 6)

/** Create the owner's app. Returns the slug it got: another business may already hold the one asked for. */
export async function createApp(content: Content): Promise<string> {
  const wanted = content.business!.slug
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? wanted : `${wanted}-${newSuffix()}`
    const data = { ...content, business: { ...content.business!, slug } }
    const { data: row, error } = await sb()
      .from('apps')
      .insert({ owner_id: (await sb().auth.getUser()).data.user?.id, slug, data })
      .select('id')
      .single()
    if (!error) {
      appId = (row as { id: string }).id
      return slug
    }
    if (error.code !== '23505' || /owner_id/.test(error.message)) throw new Error(error.message)
  }
  throw new Error('Could not find a free web address for this business name.')
}

export async function saveContent(content: Content): Promise<void> {
  must(await sb().from('apps').update({ data: content }).eq('id', appId!))
}

export async function deleteApp(): Promise<void> {
  if (!appId) return
  must(await sb().from('apps').delete().eq('id', appId))
  appId = null
}

export async function markRead(ids: string[]): Promise<void> {
  must(await sb().from('submissions').update({ read: true }).in('id', ids))
}

export async function deleteSubmissions(ids: string[]): Promise<void> {
  must(await sb().from('submissions').delete().in('id', ids))
}

/* ---------- Customers (no sign-in) ---------- */

/** The published app for a slug, or null if there is none. */
export async function fetchPublic(slug: string): Promise<Partial<Content> | null> {
  return must(await sb().rpc('get_public_app', { p_slug: slug })) as Partial<Content> | null
}

export async function submitAnswers(slug: string, formId: string, answers: Submission['values']): Promise<void> {
  must(await sb().rpc('submit_form', { p_slug: slug, p_form_id: formId, p_answers: answers }))
}

export async function subscribeDevice(slug: string, deviceId: string): Promise<void> {
  must(await sb().rpc('subscribe_device', { p_slug: slug, p_device_id: deviceId }))
}

export async function unsubscribeDevice(slug: string, deviceId: string): Promise<void> {
  must(await sb().rpc('unsubscribe_device', { p_slug: slug, p_device_id: deviceId }))
}
